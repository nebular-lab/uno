import { Dispatcher } from "@colyseus/command";
import { GameState } from "@dobon-uno/shared/dist/schema/GameState";
import { type Client, Room } from "colyseus";
import { ChooseColorCommand } from "../commands/ChooseColorCommand";
import { DobonCommand } from "../commands/DobonCommand";
import { DobonReturnCommand } from "../commands/DobonReturnCommand";
import { DrawCardCommand } from "../commands/DrawCardCommand";
import { DrawStackCommand } from "../commands/DrawStackCommand";
import { PassCommand } from "../commands/PassCommand";
// Commands
import { PlayCardCommand } from "../commands/PlayCardCommand";

export class GameRoom extends Room<GameState> {
  dispatcher = new Dispatcher(this);

  onCreate() {
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

  onJoin(client: Client) {
    console.log(`${client.sessionId} joined`);
    // TODO: プレイヤー作成処理
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
