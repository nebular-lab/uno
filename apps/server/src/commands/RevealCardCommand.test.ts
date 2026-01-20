import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import appConfig from "../app.config";

describe("RevealCardCommand", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  beforeEach(async () => {
    await colyseus.cleanup();
  });

  // ヘルパー関数: ゲームを指定フェーズまで進める
  async function setupGameUntilPhase(
    targetPhase: string,
    options?: { trackRevealingPhase?: boolean },
  ) {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    await colyseus.connectTo(room, { playerName: "Player2" });
    await colyseus.connectTo(room, { playerName: "Player3" });

    owner.send("startGame");

    let passedRevealing = false;
    const timeout = Date.now() + 15000;
    while (room.state.phase !== targetPhase && Date.now() < timeout) {
      if (options?.trackRevealingPhase && room.state.phase === "revealing") {
        passedRevealing = true;
      }
      await room.waitForNextPatch();
    }

    return { room, owner, passedRevealing };
  }

  describe("フェーズ移行", () => {
    it("countdown完了後にrevealingフェーズを経由する", async () => {
      const { room, passedRevealing } = await setupGameUntilPhase("playing", {
        trackRevealingPhase: true,
      });

      // playingフェーズに到達している
      expect(room.state.phase).toBe("playing");
      // revealingフェーズを経由したことを確認
      expect(passedRevealing).toBe(true);
    });

    it("revealing後にplayingフェーズに移行する", async () => {
      const { room } = await setupGameUntilPhase("playing");

      expect(room.state.phase).toBe("playing");
    });
  });

  describe("場札の公開", () => {
    it("fieldCardsに1枚追加される", async () => {
      const { room } = await setupGameUntilPhase("playing");

      expect(room.state.fieldCards.length).toBe(1);
    });

    it("通常カードの場合、currentColorにカードの色が設定される", async () => {
      const { room } = await setupGameUntilPhase("playing");

      // 必ず1枚は場に出ている（基本動作確認）
      expect(room.state.fieldCards.length).toBe(1);

      const fieldCard = room.state.fieldCards[0];
      // ワイルドカード以外なら色が設定される
      if (fieldCard && fieldCard.color !== "wild") {
        expect(room.state.currentColor).toBe(fieldCard.color);
        expect(["red", "blue", "green", "yellow"]).toContain(
          room.state.currentColor,
        );
      } else if (fieldCard && fieldCard.color === "wild") {
        // ワイルドカードの場合は色選択待ち
        expect(room.state.waitingForColorChoice).toBe(true);
      }
    });

    it("firstCardがfieldCardsに移動される", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");

      // countdownフェーズでfirstCardが設定されるのを待つ
      const timeout = Date.now() + 15000;
      while (room.state.phase !== "countdown" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      // firstCardが設定されていることを確認
      expect(room.state.firstCard).toBeTruthy();

      // playingフェーズまで待つ
      while (room.state.phase !== "playing" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      // fieldCardsにカードが追加されている
      expect(room.state.fieldCards.length).toBe(1);
    });
  });

  describe("最初のカード特殊処理", () => {
    // 注: これらのテストは山札をモックして特定のカードを最初に出す必要があります
    // 山札モック実装後に it.skip を it に変更して有効化してください

    it("基本動作: playingフェーズでfieldCardsに1枚存在する", async () => {
      // このテストは常に実行され、基本動作を確認する
      const { room } = await setupGameUntilPhase("playing");

      expect(room.state.phase).toBe("playing");
      expect(room.state.fieldCards.length).toBe(1);
      expect(room.state.currentTurnPlayerId).toBeTruthy();
    });

    // --- 以下は山札モック実装後に有効化 ---

    it.skip("数字カードの場合、そのまま開始される", async () => {
      // TODO: 山札をモックして数字カードを最初に出す
      const { room } = await setupGameUntilPhase("playing");

      expect(room.state.turnDirection).toBe(1);
      expect(room.state.drawStack).toBe(0);
      expect(room.state.waitingForColorChoice).toBe(false);
    });

    it.skip("リバースカードの場合、turnDirectionが-1になる", async () => {
      // TODO: 山札をモックしてリバースカードを最初に出す
      const { room } = await setupGameUntilPhase("playing");

      expect(room.state.turnDirection).toBe(-1);
    });

    it.skip("ドロー2カードの場合、drawStackが2になる", async () => {
      // TODO: 山札をモックしてドロー2カードを最初に出す
      const { room } = await setupGameUntilPhase("playing");

      expect(room.state.drawStack).toBe(2);
    });

    it.skip("スキップカードの場合、次のプレイヤーにスキップされる", async () => {
      // TODO: 山札をモックしてスキップカードを最初に出す
      // オーナーの左隣ではなく、その次のプレイヤーが手番になる
      const { room } = await setupGameUntilPhase("playing");

      expect(room.state.currentTurnPlayerId).toBeTruthy();
      // スキップ後の手番プレイヤーを検証（座席順で2つ先）
    });

    it.skip("ワイルドカードの場合、waitingForColorChoiceがtrueになる", async () => {
      // TODO: 山札をモックしてワイルドカードを最初に出す
      const { room } = await setupGameUntilPhase("playing");

      expect(room.state.waitingForColorChoice).toBe(true);
      expect(room.state.currentColor).toBe("");
    });

    it.skip("ドロー4カードの場合、drawStackが4でwaitingForColorChoiceがtrueになる", async () => {
      // TODO: 山札をモックしてドロー4カードを最初に出す
      const { room } = await setupGameUntilPhase("playing");

      expect(room.state.drawStack).toBe(4);
      expect(room.state.waitingForColorChoice).toBe(true);
      expect(room.state.currentColor).toBe("");
    });

    it.skip("強制色変えカードの場合、currentColorがカードの色になる", async () => {
      // TODO: 山札をモックして強制色変えカードを最初に出す
      const { room } = await setupGameUntilPhase("playing");

      const fieldCard = room.state.fieldCards[0];
      expect(fieldCard.value).toBe("force-change");
      // 強制色変えカードは色を持っている（red, blue, green, yellow）
      expect(room.state.currentColor).toBe(fieldCard.color);
      expect(room.state.waitingForColorChoice).toBe(false);
    });
  });
});
