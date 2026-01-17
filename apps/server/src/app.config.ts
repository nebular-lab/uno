import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import config from "@colyseus/tools";
import { LobbyRoom } from "colyseus";

/**
 * Import your Room files
 */
import { GameRoom } from "./rooms/GameRoom";

export default config({
  initializeGameServer: (gameServer) => {
    /**
     * Define your room handlers:
     */
    // ロビールーム（ルーム一覧取得用）
    gameServer.define("lobby", LobbyRoom);

    // ゲームルーム（リアルタイムリスティングを有効化）
    gameServer.define("game", GameRoom).enableRealtimeListing();
  },

  initializeExpress: (app) => {
    /**
     * Bind your custom express routes here:
     */
    app.get("/health", (_req, res) => {
      res.send("OK");
    });

    /**
     * Use @colyseus/playground
     * (It is not recommended to expose this route in a production environment)
     */
    if (process.env.NODE_ENV !== "production") {
      app.use("/", playground());
    }

    /**
     * Use @colyseus/monitor
     */
    app.use("/monitor", monitor());
  },

  beforeListen: () => {
    /**
     * Before gameServer.listen() is called.
     */
  },
});
