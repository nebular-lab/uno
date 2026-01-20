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

  onCreate(_options: CreateRoomOptions) {
    this.state = new GameState();
    this.state.roomId = this.roomId;

    // クライアント → サーバー: メッセージハンドラー登録
    this.registerMessageHandlers();
  }

  /**
   * クライアントからのメッセージハンドラーを登録
   */
  private registerMessageHandlers() {
    // カードを出す（重ね出し対応）
    this.onMessage("playCard", (client, cardIds: string[]) => {
      this.dispatcher.dispatch(new PlayCardCommand(), {
        sessionId: client.sessionId,
        cardIds: cardIds,
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

    // Ready状態を切り替え
    this.onMessage("toggleReady", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isReady = !player.isReady;
      }
    });

    // 退席
    this.onMessage("leaveRoom", (client) => {
      client.leave();
    });

    // ゲーム開始
    this.onMessage("startGame", (client) => {
      this.dispatcher.dispatch(new StartGameCommand(), {
        sessionId: client.sessionId,
        startPlayerId: this.state.nextGameStartPlayerId || undefined,
        rateMultiplier: this.state.rateMultiplier,
      });
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
    player.isConnected = true;

    // 最初のプレイヤーをオーナーに設定
    if (this.state.players.size === 0) {
      player.isOwner = true;
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

    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    // 待機中の場合はプレイヤーを削除
    if (this.state.phase === "waiting") {
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
    } else {
      // ゲーム中の場合は接続状態のみ更新
      player.isConnected = false;
    }
  }

  onDispose() {
    // Dispatcherの停止
    this.dispatcher.stop();
  }
}
