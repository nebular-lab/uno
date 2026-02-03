import { Dispatcher } from "@colyseus/command";
import {
  Card,
  type CreateRoomOptions,
  GameState,
  Player,
  type RoomMetadata,
} from "@dobon-uno/shared";
import { type Client, Room } from "colyseus";
import { ChooseColorCommand } from "../commands/ChooseColorCommand";
import { DobonCommand } from "../commands/DobonCommand";
import { DobonReturnCommand } from "../commands/DobonReturnCommand";
import { DrawCardCommand } from "../commands/DrawCardCommand";
import { DrawStackCommand } from "../commands/DrawStackCommand";
import { PassCommand } from "../commands/PassCommand";
// Commands
import { PlayCardCommand } from "../commands/PlayCardCommand";
import { StartGameCommand } from "../commands/StartGameCommand";
import { CPUPlayerService } from "../cpu/CPUPlayerService";
import { PlayerActionUpdater } from "../services/PlayerActionUpdater";
import { TurnTimerService } from "../services/TurnTimerService";
import { createDeck, shuffleDeck } from "../utils/deck";

/**
 * 山札を生成する関数の型
 * テスト時にモックを注入するために使用
 */
export type DeckProvider = () => Card[];

/**
 * デフォルトのDeckProvider（本番用）
 * 山札を生成してシャッフルする
 */
export const defaultDeckProvider: DeckProvider = () =>
  shuffleDeck(createDeck());

export class GameRoom extends Room<GameState, RoomMetadata> {
  dispatcher = new Dispatcher(this);
  maxClients = 6;

  // 山札（サーバー側のみ保持、クライアントには同期しない）
  deck: Card[] = [];

  // 山札生成関数（DI可能）
  private deckProvider: DeckProvider = defaultDeckProvider;

  // ターンタイマーサービス
  turnTimerService!: TurnTimerService;

  // CPUプレイヤーサービス
  private cpuService = new CPUPlayerService();

  onCreate(_options: CreateRoomOptions) {
    this.state = new GameState();
    this.state.roomId = this.roomId;

    // ターンタイマーサービスを初期化
    this.turnTimerService = new TurnTimerService(this.state);

    // クライアント → サーバー: メッセージハンドラー登録
    this.registerMessageHandlers();
  }

  /**
   * クライアントからのメッセージハンドラーを登録
   */
  private registerMessageHandlers() {
    // カードを出す（重ね出し対応）
    this.onMessage("playCard", (client, message: { cardIds: string[] }) => {
      this.dispatcher.dispatch(new PlayCardCommand(), {
        sessionId: client.sessionId,
        cardIds: message.cardIds,
      });
    });

    // 山札を引く
    this.onMessage("drawCard", (client) => {
      this.dispatcher.dispatch(new DrawCardCommand(), {
        sessionId: client.sessionId,
      });
    });

    // 累積カードを引く
    this.onMessage("drawStack", (client) => {
      this.dispatcher.dispatch(new DrawStackCommand(), {
        sessionId: client.sessionId,
      });
    });

    // パス
    this.onMessage("pass", (client) => {
      this.dispatcher.dispatch(new PassCommand(), {
        sessionId: client.sessionId,
      });
    });

    // ドボン
    this.onMessage("dobon", (client) => {
      this.dispatcher.dispatch(new DobonCommand(), {
        sessionId: client.sessionId,
      });
    });

    // ドボン返し
    this.onMessage("dobonReturn", (client) => {
      this.dispatcher.dispatch(new DobonReturnCommand(), {
        sessionId: client.sessionId,
      });
    });

    // 色を選択
    this.onMessage("chooseColor", (client, color: string) => {
      this.dispatcher.dispatch(new ChooseColorCommand(), {
        sessionId: client.sessionId,
        color: color,
      });
    });

    // 退席
    this.onMessage("leaveRoom", (client) => {
      client.leave(1000); // コード1000（正常終了）
    });

    // ゲーム開始
    this.onMessage("startGame", (client) => {
      this.dispatcher.dispatch(new StartGameCommand(), {
        sessionId: client.sessionId,
        startPlayerId: this.state.nextGameStartPlayerId || undefined,
        rateMultiplier: this.state.rateMultiplier,
      });
    });

    // CPUを追加
    this.onMessage("addCpu", (client, message: { seatId: number }) => {
      // ホストのみ実行可能
      const player = this.state.players.get(client.sessionId);
      if (!player?.isOwner) return;

      // ゲーム中は追加不可
      if (this.state.phase !== "waiting") return;

      // 最大プレイヤー数チェック
      if (this.state.players.size >= this.maxClients) return;

      // 指定された席が空いているか確認
      let seatOccupied = false;
      this.state.players.forEach((p) => {
        if (p.seatId === message.seatId) seatOccupied = true;
      });
      if (seatOccupied) return;

      // CPUプレイヤーを追加
      this.addCPUPlayer(`cpu${message.seatId}`, message.seatId);
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
        this.setDeckProvider(() => deck);
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
            this.updateAllPlayerActions();
          }
        }
      },
    );

    // テスト用: hasDrawnThisTurn を設定
    this.onMessage("__setHasDrawnThisTurn", (_client, value: boolean) => {
      this.state.hasDrawnThisTurn = value;
      // canPass を更新
      if (this.state.phase === "playing") {
        this.updateAllPlayerActions();
      }
    });

    // テスト用: 現在のプレイヤーのタイマーを停止
    this.onMessage("__stopTimer", () => {
      this.turnTimerService.stopTimer(this.state.currentTurnPlayerId);
    });

    // テスト用: ターンタイムアウト時間を設定
    this.onMessage("__setTurnTimeout", (_client, timeout: number) => {
      this.turnTimerService.setTurnTimeout(timeout);
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
          this.updateAllPlayerActions();
        }
      },
    );
  }

  /**
   * 山札を生成する（DeckProviderを使用）
   */
  createDeck(): Card[] {
    return this.deckProvider();
  }

  /**
   * DeckProviderを設定する（テスト用）
   */
  setDeckProvider(provider: DeckProvider) {
    this.deckProvider = provider;
  }

  /**
   * 全プレイヤーのアクション可否を更新する（テスト用）
   */
  private updateAllPlayerActions() {
    // 色が未決定（最初のカードがwild/draw4で引いた場合等）なら何でも出せる
    const isColorNotSet = this.state.currentColor === "";
    const actionUpdater = new PlayerActionUpdater(this.state);
    actionUpdater.update({ isFirstCardWild: isColorNotSet });
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

  onJoin(client: Client, options: CreateRoomOptions) {
    console.log(`${client.sessionId} joined`);

    // プレイヤーを作成
    const player = new Player();
    player.sessionId = client.sessionId;
    player.name = options.playerName;
    player.seatId = this.getNextAvailableSeat();

    // 最初のプレイヤーをオーナーに設定
    if (this.state.players.size === 0) {
      player.isOwner = true;
    }

    // ゲーム中に参加した場合は観戦者として設定
    if (this.state.phase !== "waiting") {
      player.isSpectator = true;
    }

    // プレイヤーを追加
    this.state.players.set(client.sessionId, player);

    // メタデータを更新
    this.updateMetadata();
  }

  private updateMetadata() {
    // オーナーを取得
    let ownerName: string | undefined;
    for (const player of this.state.players.values()) {
      if (player.isOwner) {
        ownerName = player.name;
        break;
      }
    }

    this.setMetadata({
      ownerName,
    });
  }

  onLeave(client: Client) {
    console.log(`${client.sessionId} left`);

    // 退出プレイヤーのタイマーを停止
    this.turnTimerService.stopTimer(client.sessionId);

    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const wasOwner = player.isOwner;
    this.state.players.delete(client.sessionId);

    // オーナーが退出した場合、次のプレイヤーをオーナーに
    if (wasOwner && this.state.players.size > 0) {
      const nextOwner = this.state.players.values().next().value;
      if (nextOwner) {
        nextOwner.isOwner = true;
      }
    }

    // メタデータを更新
    this.updateMetadata();
  }

  onDispose() {
    // 全タイマーを停止
    this.turnTimerService.stopAllTimers();

    // Dispatcherの停止
    this.dispatcher.stop();
  }

  /**
   * CPUプレイヤーを追加する
   */
  private addCPUPlayer(name: string, seatId: number): void {
    const sessionId = `cpu-${crypto.randomUUID()}`;
    const player = new Player();
    player.sessionId = sessionId;
    player.name = name;
    player.isCpu = true;
    player.seatId = seatId;
    this.state.players.set(sessionId, player);
  }

  /**
   * CPUターンをチェックして実行する
   * PlayerActionUpdater.update() 後に呼び出す
   */
  async checkCPUTurn(): Promise<void> {
    const currentPlayer = this.state.players.get(
      this.state.currentTurnPlayerId,
    );

    if (currentPlayer?.isCpu && this.state.phase === "playing") {
      await this.cpuService.handleTurn(
        this.state,
        currentPlayer,
        this.dispatcher,
      );
    }
  }

  /**
   * ゲーム状態をリセットする（次のゲーム開始前の状態に戻す）
   * NormalFinishCommand、DobonCommand、DobonReturnCommandから呼び出される
   */
  resetGameState() {
    // プレイヤー状態のリセット
    for (const player of this.state.players.values()) {
      // 手札をクリア
      player.myHand.splice(0, player.myHand.length);
      player.handCount = 0;

      // アクションフラグをリセット
      player.canPass = false;
      player.canDraw = false;
      player.canChooseColor = false;
      player.canDobon = false;
      player.canDobonReturn = false;
      player.canDrawStack = false;
      player.playableCards.clear();
      player.timeRemaining = 0;
    }

    // ゲーム状態のリセット
    this.state.fieldCards.splice(0, this.state.fieldCards.length);
    this.state.discardPile.splice(0, this.state.discardPile.length);
    this.state.deckCount = 0;
    this.state.currentColor = "";
    this.state.currentTurnPlayerId = "";
    this.state.turnDirection = 1;
    this.state.drawStack = 0;
    this.state.waitingForColorChoice = false;
    this.state.hasDrawnThisTurn = false;
    this.state.lastPlayedCount = 1;
    this.state.firstCard = null;
    this.state.dealingRound = 0;
    this.state.countdown = 0;

    // ドボン状態のリセット
    this.state.dobonTargetId = "";
    this.state.dobonPlayerIds.splice(0, this.state.dobonPlayerIds.length);

    // 山札をクリア
    this.deck = [];
  }
}
