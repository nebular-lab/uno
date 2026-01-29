import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import appConfig from "../app.config";

// テスト用カードデータ
const testCards = {
  red5: { id: "r5", color: "red", value: "5", points: 5 },
  red3: { id: "r3", color: "red", value: "3", points: 3 },
  blue7: { id: "b7", color: "blue", value: "7", points: 7 },
  green2: { id: "g2", color: "green", value: "2", points: 2 },
  yellow9: { id: "y9", color: "yellow", value: "9", points: 9 },
};

type CardData = { id: string; color: string; value: string; points: number };

// ダミーカードを生成
function createDummyCard(index: number): CardData {
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

// 7枚のダミー手札を生成
function dummyHand(startIndex: number): CardData[] {
  return Array.from({ length: 7 }, (_, i) => createDummyCard(startIndex + i));
}

/**
 * プレイヤーごとの手札を指定してデッキを生成する
 */
function createTestDeckWithPlayerHands(
  firstCard: CardData,
  player1Hand: CardData[],
  player2Hand: CardData[],
  player3Hand: CardData[],
) {
  const deck: CardData[] = [];

  for (let i = 0; i < 80; i++) {
    deck.push(createDummyCard(i));
  }

  deck.push(firstCard);

  // デッキは末尾からpopされるので、逆順に追加する
  for (let round = 6; round >= 0; round--) {
    deck.push(player3Hand[round] || createDummyCard(300 + round));
    deck.push(player2Hand[round] || createDummyCard(200 + round));
    deck.push(player1Hand[round] || createDummyCard(100 + round));
  }

  return deck;
}

describe("NormalFinishCommand", () => {
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

  // ヘルパー: プレイヤーごとの手札を指定してplayingフェーズまで進める
  async function setupWithHands(
    firstCard: CardData,
    p1Hand: CardData[],
    p2Hand: CardData[],
    p3Hand: CardData[],
  ) {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    const player2 = await colyseus.connectTo(room, { playerName: "Player2" });
    const player3 = await colyseus.connectTo(room, { playerName: "Player3" });

    const testDeck = createTestDeckWithPlayerHands(
      firstCard,
      p1Hand,
      p2Hand,
      p3Hand,
    );
    owner.send("__setDeck", testDeck);
    await new Promise((resolve) => setTimeout(resolve, 50));

    owner.send("startGame");

    const timeout = Date.now() + 15000;
    while (room.state.phase !== "playing" && Date.now() < timeout) {
      await room.waitForNextPatch();
    }

    return { room, owner, player2, player3 };
  }

  // -------------------------------------------------------
  // フェーズ遷移
  // -------------------------------------------------------
  describe("フェーズ遷移", () => {
    it("上がりが発生するとフェーズがresultに変わる", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        [testCards.red3], // Owner: 1枚で上がれる
        dummyHand(200),
        dummyHand(300),
      );

      expect(room.state.phase).toBe("playing");

      owner.send("playCard", { cardIds: [testCards.red3.id] });

      // フェーズがresultに変わるまで待つ
      const timeout = Date.now() + 5000;
      while (room.state.phase !== "result" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      expect(room.state.phase).toBe("result");
    });
  });

  // -------------------------------------------------------
  // 収支計算
  // -------------------------------------------------------
  describe("収支計算", () => {
    it("上がったプレイヤーは他のプレイヤーの手札合計点数を獲得する", async () => {
      // Player2: 7点、Player3: 手札合計を計算
      const { room, owner, player2, player3 } = await setupWithHands(
        testCards.red5,
        [testCards.red3], // Owner: 上がる
        [testCards.blue7], // Player2: 7点
        [testCards.yellow9], // Player3: 9点
      );

      const ownerPlayer = room.state.players.get(owner.sessionId);
      const p2Player = room.state.players.get(player2.sessionId);
      const p3Player = room.state.players.get(player3.sessionId);

      const ownerScoreBefore = ownerPlayer?.score || 0;
      const p2ScoreBefore = p2Player?.score || 0;
      const p3ScoreBefore = p3Player?.score || 0;

      owner.send("playCard", { cardIds: [testCards.red3.id] });

      const timeout = Date.now() + 5000;
      while (room.state.phase !== "result" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      // Owner: +7 +9 = +16点
      expect(ownerPlayer?.score).toBe(ownerScoreBefore + 16);
      // Player2: -7点
      expect(p2Player?.score).toBe(p2ScoreBefore - 7);
      // Player3: -9点
      expect(p3Player?.score).toBe(p3ScoreBefore - 9);
    });

    it("レート倍率が適用される（山札切れ連続後）", async () => {
      const { room, owner, player2 } = await setupWithHands(
        testCards.red5,
        [testCards.red3], // Owner: 上がる
        [testCards.blue7], // Player2: 7点
        [testCards.yellow9], // Player3: 9点
      );

      // 山札切れ1回後を想定（レート2倍）
      room.state.rateMultiplier = 2;

      const ownerPlayer = room.state.players.get(owner.sessionId);
      const p2Player = room.state.players.get(player2.sessionId);

      const ownerScoreBefore = ownerPlayer?.score || 0;
      const p2ScoreBefore = p2Player?.score || 0;

      owner.send("playCard", { cardIds: [testCards.red3.id] });

      const timeout = Date.now() + 5000;
      while (room.state.phase !== "result" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      // 2倍になる: Owner: +32点, Player2: -14点
      expect(ownerPlayer?.score).toBe(ownerScoreBefore + 32);
      expect(p2Player?.score).toBe(p2ScoreBefore - 14);
    });
  });

  // -------------------------------------------------------
  // ゲーム結果履歴
  // -------------------------------------------------------
  describe("ゲーム結果履歴", () => {
    it("GameResultがgameHistoryに追加される", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        [testCards.red3],
        dummyHand(200),
        dummyHand(300),
      );

      const historyLengthBefore = room.state.gameHistory.length;

      owner.send("playCard", { cardIds: [testCards.red3.id] });

      const timeout = Date.now() + 5000;
      while (room.state.phase !== "result" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      expect(room.state.gameHistory.length).toBe(historyLengthBefore + 1);
    });
  });

  // -------------------------------------------------------
  // 次のゲームの準備
  // -------------------------------------------------------
  describe("次のゲームの準備", () => {
    it("次のゲームの最初のプレイヤーが上がったプレイヤーに設定される", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        [testCards.red3],
        dummyHand(200),
        dummyHand(300),
      );

      owner.send("playCard", { cardIds: [testCards.red3.id] });

      const timeout = Date.now() + 5000;
      while (room.state.phase !== "result" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      expect(room.state.nextGameStartPlayerId).toBe(owner.sessionId);
    });

    it("レート倍率が1にリセットされる", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        [testCards.red3],
        dummyHand(200),
        dummyHand(300),
      );

      // 山札切れ後を想定
      room.state.rateMultiplier = 4;
      room.state.consecutiveDeckouts = 2;

      owner.send("playCard", { cardIds: [testCards.red3.id] });

      const timeout = Date.now() + 5000;
      while (room.state.phase !== "result" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      expect(room.state.rateMultiplier).toBe(1);
      expect(room.state.consecutiveDeckouts).toBe(0);
    });
  });

  // -------------------------------------------------------
  // フェーズ遷移（result → waiting）
  // -------------------------------------------------------
  describe("result後のフェーズ遷移", () => {
    it("一定時間後にwaitingフェーズに戻る", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        [testCards.red3],
        dummyHand(200),
        dummyHand(300),
      );

      owner.send("playCard", { cardIds: [testCards.red3.id] });

      // resultフェーズになるまで待つ
      let timeout = Date.now() + 5000;
      while (room.state.phase !== "result" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }
      expect(room.state.phase).toBe("result");

      // waitingフェーズに戻るまで待つ（最大10秒）
      timeout = Date.now() + 10000;
      while (room.state.phase !== "waiting" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }
      expect(room.state.phase).toBe("waiting");
    });
  });
});
