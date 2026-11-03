import {
  createDeck,
  type DeckProvider,
  GameEngine,
  ResolveDobonWaitCommand,
  shuffleDeck,
} from "@dobon-uno/game-core";
import {
  Card,
  type GameState,
  type JoinRoomOptions,
  Player,
  type RoomMetadata,
} from "@dobon-uno/shared";
import { type Client, Room, ServerError } from "colyseus";

/**
 * 動作確認用: 環境変数 DEBUG_DECK_SIZE を指定すると、シャッフル後の山札をその枚数に減らす
 * （例: 31 なら4人で配り終えて最初の場札を出した時点で山札が2枚残る）
 */
const debugDeckSize = Number(process.env.DEBUG_DECK_SIZE) || undefined;

/**
 * デフォルトのDeckProvider（本番用）
 * 山札を生成してシャッフルする
 */
const defaultDeckProvider: DeckProvider = () => {
  const deck = shuffleDeck(createDeck());
  return debugDeckSize ? deck.slice(-debugDeckSize) : deck;
};

// プレイヤーの最大人数（観戦者は含まない）
export const MAX_PLAYERS = 6;

// 観戦者の最大人数
export const MAX_SPECTATORS = 10;

// 参加を拒否したときのエラーコード
export const JOIN_REJECTED_CODE = 4403;

// ゲーム操作のメッセージ（GameEngineに渡す）
const GAME_ACTION_TYPES = [
  "playCard",
  "drawCard",
  "drawStack",
  "pass",
  "dobon",
  "skipDobon",
  "dobonReturn",
  "chooseColor",
  "startGame",
  "updateGameSettings",
];

export class GameRoom extends Room<{
  state: GameState;
  metadata: RoomMetadata;
}> {
  // 観戦者も1クライアントとして数えられるため、プレイヤー上限は MAX_PLAYERS で別に判定する
  maxClients = MAX_PLAYERS + MAX_SPECTATORS;

  // ゲームの状態と進行（ルール処理・CPU）
  private engine!: GameEngine;

  // 一度でもゲームを開始したか（開始後はwaitingに戻ってもプレイヤーとして参加できない）
  private hasStarted = false;

  // 観戦者のsessionId（観戦者はstate.playersに含めない）
  private spectatorIds = new Set<string>();

  // 前回設定したメタデータ（変化がなければsetMetadataしない）
  private lastMetadataJson = "";

  onCreate() {
    this.engine = new GameEngine({
      clock: this.clock,
      broadcast: (type, message) => this.broadcast(type, message),
      deckProvider: defaultDeckProvider,
    });
    this.state = this.engine.state;
    this.state.roomId = this.roomId;

    // クライアント → サーバー: メッセージハンドラー登録
    this.registerMessageHandlers();
  }

  /**
   * クライアントからのメッセージハンドラーを登録
   */
  private registerMessageHandlers() {
    // ゲーム操作（カードを出す・引く・ドボンなど）
    for (const type of GAME_ACTION_TYPES) {
      this.onMessage(type, (client, message) => {
        this.engine.handleAction(client.sessionId, type, message);
      });
    }

    // 退席
    this.onMessage("leaveRoom", (client) => {
      client.leave(1000); // コード1000（正常終了）
    });

    // CPUを追加
    this.onMessage("addCpu", (client, message: { seatId: number }) => {
      // ホストのみ実行可能
      const player = this.state.players.get(client.sessionId);
      if (!player?.isOwner) return;

      // ゲーム中は追加不可
      if (this.state.phase !== "waiting") return;

      // 最大プレイヤー数チェック
      if (this.state.players.size >= MAX_PLAYERS) return;

      // 指定された席が空いているか確認
      let seatOccupied = false;
      this.state.players.forEach((p) => {
        if (p.seatId === message.seatId) seatOccupied = true;
      });
      if (seatOccupied) return;

      // CPUプレイヤーを追加
      this.engine.addCPUPlayer(`CPU ${message.seatId}`, message.seatId);
    });

    // CPUを削除
    this.onMessage("removeCpu", (client, message: { sessionId: string }) => {
      // ホストのみ実行可能
      const player = this.state.players.get(client.sessionId);
      if (!player?.isOwner) return;

      // ゲーム中は削除不可
      if (this.state.phase !== "waiting") return;

      // 対象がCPUプレイヤーか確認
      const cpuPlayer = this.state.players.get(message.sessionId);
      if (!cpuPlayer?.isCpu) return;

      // CPUプレイヤーを削除
      this.state.players.delete(message.sessionId);
    });

    // テスト用: 山札を設定（カードデータの配列を受け取る）
    this.onMessage(
      "__setDeck",
      (
        _client,
        cards: { id: string; color: string; value: string; points: number }[],
      ) => {
        const deck = cards.map(
          (c) => new Card(c.id, c.color, c.value, c.points),
        );
        this.engine.setDeckProvider(() => deck);
      },
    );

    // テスト用: 特定プレイヤーの手札を設定
    this.onMessage(
      "__setHand",
      (
        client,
        cards: { id: string; color: string; value: string; points: number }[],
      ) => {
        const player = this.state.players.get(client.sessionId);
        if (player) {
          player.myHand.splice(0, player.myHand.length);
          for (const c of cards) {
            player.myHand.push(new Card(c.id, c.color, c.value, c.points));
          }
          player.handCount = player.myHand.length;

          // playableCards と canDobon を更新
          if (this.state.phase === "playing") {
            this.engine.updateAllPlayerActions();
          }
        }
      },
    );

    // テスト用: hasDrawnThisTurn を設定
    this.onMessage("__setHasDrawnThisTurn", (_client, value: boolean) => {
      this.state.hasDrawnThisTurn = value;
      // canPass を更新
      if (this.state.phase === "playing") {
        this.engine.updateAllPlayerActions();
      }
    });

    // テスト用: 現在のプレイヤーのタイマーを停止
    this.onMessage("__stopTimer", () => {
      this.engine.turnTimerService.stopTimer(this.state.currentTurnPlayerId);
    });

    // テスト用: ターンタイムアウト時間を設定
    this.onMessage("__setTurnTimeout", (_client, timeout: number) => {
      this.engine.turnTimerService.setTurnTimeout(timeout);
    });

    // テスト用: 場札を設定
    this.onMessage(
      "__setFieldCard",
      (
        _client,
        card: { id: string; color: string; value: string; points: number },
      ) => {
        const fieldCard = new Card(
          card.id,
          card.color,
          card.value,
          card.points,
        );
        this.state.fieldCards.splice(0, this.state.fieldCards.length);
        this.state.fieldCards.push(fieldCard);
        this.state.currentColor = card.color;

        // アクション可否を更新
        if (this.state.phase === "playing") {
          this.engine.updateAllPlayerActions();
        }
      },
    );
  }

  // 席の配置優先順（1, 3, 5, 2, 4, 6 の順）
  private static readonly SEAT_PRIORITY = [1, 3, 5, 2, 4, 6];

  /**
   * 次に空いている席を取得（優先順位順）
   */
  private getNextAvailableSeat(): number {
    const occupiedSeats = new Set<number>();
    for (const player of this.state.players.values()) {
      occupiedSeats.add(player.seatId);
    }

    for (const seatId of GameRoom.SEAT_PRIORITY) {
      if (!occupiedSeats.has(seatId)) {
        return seatId;
      }
    }

    // 全席埋まっている場合（通常は発生しない）
    return 1;
  }

  /**
   * ゲームを開始済みかどうか
   */
  private isStarted(): boolean {
    return this.hasStarted || this.state.phase !== "waiting";
  }

  /**
   * 参加可否を判定する
   * - プレイヤー: ゲーム開始前かつ空席がある場合のみ
   * - 観戦者: ゲーム開始後のみ
   */
  onAuth(_client: Client, options: JoinRoomOptions) {
    if (options?.spectate) {
      if (!this.isStarted()) {
        throw new ServerError(
          JOIN_REJECTED_CODE,
          "開始前のルームは観戦できません",
        );
      }
      if (this.spectatorIds.size >= MAX_SPECTATORS) {
        throw new ServerError(JOIN_REJECTED_CODE, "観戦者が満員です");
      }
      return true;
    }

    if (this.isStarted()) {
      throw new ServerError(
        JOIN_REJECTED_CODE,
        "ゲームが開始されているため参加できません",
      );
    }
    if (this.state.players.size >= MAX_PLAYERS) {
      throw new ServerError(JOIN_REJECTED_CODE, "ルームが満員です");
    }
    // 成績表などでプレイヤーを名前で見分けられるよう、同じ名前では参加させない
    const isNameTaken = Array.from(this.state.players.values()).some(
      (p) => p.name === options?.playerName,
    );
    if (isNameTaken) {
      throw new ServerError(
        JOIN_REJECTED_CODE,
        "同じ名前のプレイヤーがいるため参加できません",
      );
    }
    return true;
  }

  onJoin(client: Client, options: JoinRoomOptions) {
    console.log(`${client.sessionId} joined`);

    // 観戦者はプレイヤーとして追加しない
    if (options?.spectate) {
      this.spectatorIds.add(client.sessionId);
      this.state.spectatorCount = this.spectatorIds.size;
      this.updateMetadata();
      return;
    }

    // プレイヤーを作成
    const player = new Player();
    player.sessionId = client.sessionId;
    player.name = options.playerName;
    player.seatId = this.getNextAvailableSeat();

    // 最初のプレイヤーをオーナーに設定
    if (this.state.players.size === 0) {
      player.isOwner = true;
    }

    // プレイヤーを追加
    this.state.players.set(client.sessionId, player);

    // メタデータを更新
    this.updateMetadata();
  }

  /**
   * パッチ送信前にメタデータを同期する
   * （phaseはCommand内で変わるため、ここでまとめて検知する）
   */
  onBeforePatch() {
    this.updateMetadata();
  }

  /**
   * ロビーに表示するメタデータを更新する（変化があったときだけ）
   */
  private updateMetadata() {
    if (this.state.phase !== "waiting") {
      this.hasStarted = true;
    }

    const players = Array.from(this.state.players.values()).sort(
      (a, b) => a.seatId - b.seatId,
    );
    const metadata: RoomMetadata = {
      ownerName: players.find((p) => p.isOwner)?.name,
      status: this.hasStarted ? "playing" : "waiting",
      playerNames: players.map((p) => p.name),
      spectatorCount: this.spectatorIds.size,
    };

    const json = JSON.stringify(metadata);
    if (json === this.lastMetadataJson) return;
    this.lastMetadataJson = json;
    this.setMetadata(metadata);
  }

  onLeave(client: Client) {
    console.log(`${client.sessionId} left`);

    // 観戦者の退出
    if (this.spectatorIds.delete(client.sessionId)) {
      this.state.spectatorCount = this.spectatorIds.size;
      this.updateMetadata();
      return;
    }

    // 退出プレイヤーのタイマーを停止
    this.engine.turnTimerService.stopTimer(client.sessionId);

    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const wasOwner = player.isOwner;
    this.state.players.delete(client.sessionId);

    // ドボン待ちの間に抜けた場合、残りの人の判断で待ちを解決する
    if (this.state.phase === "playing" && this.state.waitingForDobon) {
      this.engine.dispatcher.dispatch(new ResolveDobonWaitCommand());
    }

    // 人間プレイヤーがいなくなったらCPUも削除（ルーム自動破棄のため）
    const hasHumanPlayer = Array.from(this.state.players.values()).some(
      (p) => !p.isCpu,
    );
    if (!hasHumanPlayer) {
      // CPUプレイヤーをすべて削除
      for (const [sessionId, p] of this.state.players.entries()) {
        if (p.isCpu) {
          this.state.players.delete(sessionId);
        }
      }
      // 観戦者だけが残っている場合は切断してルームを破棄する
      if (this.spectatorIds.size > 0) {
        this.disconnect();
      }
      return; // ルームは自動破棄される
    }

    // オーナーが退出した場合、次の人間プレイヤーをオーナーに
    if (wasOwner && this.state.players.size > 0) {
      // 人間プレイヤーを優先してオーナーにする
      let nextOwner: Player | undefined;
      for (const p of this.state.players.values()) {
        if (!p.isCpu) {
          nextOwner = p;
          break;
        }
      }
      // 人間プレイヤーがいない場合は最初のプレイヤー（上で処理済みなので通常到達しない）
      if (!nextOwner) {
        nextOwner = this.state.players.values().next().value;
      }
      if (nextOwner) {
        nextOwner.isOwner = true;
      }
    }

    // メタデータを更新
    this.updateMetadata();
  }

  onDispose() {
    // 全タイマーとDispatcherを停止
    this.engine.stop();
  }
}
