import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import appConfig from "../app.config";

// テスト用カードデータ
const testCards = {
  number: { id: "r5", color: "red", value: "5", points: 5 },
  skip: { id: "r-skip", color: "red", value: "skip", points: 20 },
  reverse: { id: "b-reverse", color: "blue", value: "reverse", points: 20 },
  draw2: { id: "g-draw2", color: "green", value: "draw2", points: 20 },
  wild: { id: "wild-1", color: "wild", value: "wild", points: 50 },
  draw4: { id: "draw4-1", color: "wild", value: "draw4", points: 50 },
  forceChange: {
    id: "y-force-change",
    color: "yellow",
    value: "force-change",
    points: 40,
  },
};

// ダミーカードを生成
function createDummyCard(index: number) {
  const colors = ["red", "blue", "green", "yellow"];
  const color = colors[index % 4];
  const value = String(index % 10);
  return {
    id: `${color[0]}${value}-${index}`,
    color,
    value,
    points: index % 10,
  };
}

/**
 * テスト用デッキを生成する
 * firstCardを指定し、残りはダミーカードで埋める
 *
 * デッキ構造（popで取るので後ろから消費される）:
 * [残りカード... | firstCard | 手札用21枚]
 *                             ↑ 手札配布後にpopされる
 *
 * 配布順序:
 * 1. deck.pop() × 21回 → 手札用カード
 * 2. deck.pop() × 1回 → firstCard
 */
function createTestDeck(
  firstCard: { id: string; color: string; value: string; points: number },
  playerCount = 3,
) {
  const deck = [];
  const handCardsNeeded = playerCount * 7; // 3人 × 7枚 = 21枚

  // 残りの山札（十分な枚数）
  for (let i = 0; i < 80; i++) {
    deck.push(createDummyCard(i));
  }

  // firstCard（手札配布後にpopされる）
  deck.push(firstCard);

  // 手札用カード（21枚）- 最後にpopされるので配列の末尾に
  for (let i = 0; i < handCardsNeeded; i++) {
    deck.push(createDummyCard(100 + i));
  }

  return deck;
}

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

  // ヘルパー関数: 特定のカードを最初の場札に設定してゲームを進める
  async function setupGameWithFirstCard(
    cardData: { id: string; color: string; value: string; points: number },
    targetPhase: string,
  ) {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    await colyseus.connectTo(room, { playerName: "Player2" });
    await colyseus.connectTo(room, { playerName: "Player3" });

    // テスト用デッキを設定（DIでデッキ全体を差し替え）
    const testDeck = createTestDeck(cardData, 3);
    owner.send("__setDeck", testDeck);
    await new Promise((resolve) => setTimeout(resolve, 50));

    owner.send("startGame");

    const timeout = Date.now() + 15000;
    while (room.state.phase !== targetPhase && Date.now() < timeout) {
      await room.waitForNextPatch();
    }

    return { room, owner };
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
    it("基本動作: playingフェーズでfieldCardsに1枚存在する", async () => {
      const { room } = await setupGameUntilPhase("playing");

      expect(room.state.phase).toBe("playing");
      expect(room.state.fieldCards.length).toBe(1);
      expect(room.state.currentTurnPlayerId).toBeTruthy();
    });

    it("数字カードの場合、そのまま開始される", async () => {
      const { room } = await setupGameWithFirstCard(
        testCards.number,
        "playing",
      );

      expect(room.state.fieldCards[0].value).toBe("5");
      expect(room.state.turnDirection).toBe(1);
      expect(room.state.drawStack).toBe(0);
      expect(room.state.waitingForColorChoice).toBe(false);
      expect(room.state.currentColor).toBe("red");
    });

    it("リバースカードの場合、turnDirectionが-1になる", async () => {
      const { room } = await setupGameWithFirstCard(
        testCards.reverse,
        "playing",
      );

      expect(room.state.fieldCards[0].value).toBe("reverse");
      expect(room.state.turnDirection).toBe(-1);
      expect(room.state.currentColor).toBe("blue");
    });

    it("ドロー2カードの場合、drawStackが2になる", async () => {
      const { room } = await setupGameWithFirstCard(testCards.draw2, "playing");

      expect(room.state.fieldCards[0].value).toBe("draw2");
      expect(room.state.drawStack).toBe(2);
      expect(room.state.currentColor).toBe("green");
    });

    it("スキップカードの場合、次のプレイヤーにスキップされる", async () => {
      const { room, owner } = await setupGameWithFirstCard(
        testCards.skip,
        "playing",
      );

      expect(room.state.fieldCards[0].value).toBe("skip");
      expect(room.state.currentColor).toBe("red");

      // オーナー（seat 1）がcurrentTurnPlayerIdに設定されるが、
      // skipによって次のプレイヤーにスキップされる
      // 座席順: Owner(1) -> Player2(3) -> Player3(5)
      // オーナーの手番がスキップされ、Player2の手番になるはず
      // ただしオーナーからスタートしてオーナーがスキップなので、Player2が手番
      expect(room.state.currentTurnPlayerId).not.toBe(owner.sessionId);
    });

    it("ワイルドカードの場合、waitingForColorChoiceがtrueになる", async () => {
      const { room } = await setupGameWithFirstCard(testCards.wild, "playing");

      expect(room.state.fieldCards[0].value).toBe("wild");
      expect(room.state.waitingForColorChoice).toBe(true);
      expect(room.state.currentColor).toBe("");
    });

    it("ドロー4カードの場合、drawStackが4でwaitingForColorChoiceがtrueになる", async () => {
      const { room } = await setupGameWithFirstCard(testCards.draw4, "playing");

      expect(room.state.fieldCards[0].value).toBe("draw4");
      expect(room.state.drawStack).toBe(4);
      expect(room.state.waitingForColorChoice).toBe(true);
      expect(room.state.currentColor).toBe("");
    });

    it("強制色変えカードの場合、currentColorがカードの色になる", async () => {
      const { room } = await setupGameWithFirstCard(
        testCards.forceChange,
        "playing",
      );

      const fieldCard = room.state.fieldCards[0];
      expect(fieldCard.value).toBe("force-change");
      expect(room.state.currentColor).toBe("yellow");
      expect(room.state.waitingForColorChoice).toBe(false);
    });
  });
});
