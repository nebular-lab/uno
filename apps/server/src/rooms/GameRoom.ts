import { Dispatcher } from "@colyseus/command";
import {
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

export class GameRoom extends Room<GameState, RoomMetadata> {
  dispatcher = new Dispatcher(this);
  maxClients = 6;

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
  }

  onJoin(client: Client, options: CreateRoomOptions) {
    console.log(`${client.sessionId} joined`);

    // プレイヤーを作成
    const player = new Player();
    player.sessionId = client.sessionId;
    player.name = options.playerName;
    player.seatId = this.state.players.size + 1;
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
    // TODO: プレイヤー退出処理
  }

  onDispose() {
    // Dispatcherの停止
    this.dispatcher.stop();
  }
}
