import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bootTestServer } from "../test/setup";

type CardData = { id: string; color: string; value: string; points: number };

// テスト用カードデータ
const testCards = {
  red5: { id: "r5", color: "red", value: "5", points: 5 },
  red3: { id: "r3", color: "red", value: "3", points: 3 },
  blue7: { id: "b7", color: "blue", value: "7", points: 7 },
  green9: { id: "g9", color: "green", value: "9", points: 9 },
};

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
    colyseus = await bootTestServer();
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

    // 手札を設定するヘルパー（playing フェーズ後に呼ぶ）
    const setHand = async (
      client: typeof owner,
      cards: CardData[],
    ): Promise<void> => {
      client.send("__setHand", cards);
      await new Promise((resolve) => setTimeout(resolve, 50));
    };

    return { room, owner, player2, player3, setHand };
  }

  // -------------------------------------------------------
  // バリデーション
  // -------------------------------------------------------
  describe("バリデーション", () => {
    it("playingフェーズ以外は拒否（NormalFinishCommandは直接呼ばれない）", async () => {
      // NormalFinishCommandはPlayCardCommandから呼ばれるため、
      // 間接的にテスト（waitingフェーズでカードを出そうとしても拒否される）
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      expect(room.state.phase).toBe("waiting");

      owner.send("playCard", { cardIds: ["dummy-card"] });
      await new Promise((resolve) => setTimeout(resolve, 50));

      // フェーズは変わらない
      expect(room.state.phase).toBe("waiting");
    });
  });

  // -------------------------------------------------------
  // 点数計算
  // -------------------------------------------------------
  describe("点数計算", () => {
    it("各プレイヤーが手札合計点を失い、勝者がその合計を獲得", async () => {
      const { room, owner, player2, player3, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // 手札を設定
      // Owner: 赤3のみ（3点）→ 上がり
      // Player2: 青7（7点）
      // Player3: 緑9（9点）
      await setHand(owner, [testCards.red3]);
      await setHand(player2, [testCards.blue7]);
      await setHand(player3, [testCards.green9]);

      // スコアを記録
      const ownerPlayer = room.state.players.get(owner.sessionId);
      const p2Player = room.state.players.get(player2.sessionId);
      const p3Player = room.state.players.get(player3.sessionId);

      const ownerScoreBefore = ownerPlayer?.score || 0;
      const p2ScoreBefore = p2Player?.score || 0;
      const p3ScoreBefore = p3Player?.score || 0;

      // Ownerが上がり
      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 点数変動を確認
      // Owner: +7+9 = +16
      // Player2: -7
      // Player3: -9
      expect(ownerPlayer?.score).toBe(ownerScoreBefore + 16);
      expect(p2Player?.score).toBe(p2ScoreBefore - 7);
      expect(p3Player?.score).toBe(p3ScoreBefore - 9);
    });

    it("レート倍率が適用される", async () => {
      const { room, owner, player2, player3, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // レート倍率を2に設定（事前に山札切れがあった想定）
      room.state.rateMultiplier = 2;

      // 手札を設定
      await setHand(owner, [testCards.red3]);
      await setHand(player2, [testCards.blue7]);
      await setHand(player3, [testCards.green9]);

      const ownerPlayer = room.state.players.get(owner.sessionId);
      const p2Player = room.state.players.get(player2.sessionId);
      const p3Player = room.state.players.get(player3.sessionId);

      const ownerScoreBefore = ownerPlayer?.score || 0;
      const p2ScoreBefore = p2Player?.score || 0;
      const p3ScoreBefore = p3Player?.score || 0;

      // Ownerが上がり
      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 点数変動を確認（2倍）
      // Owner: +32
      // Player2: -14
      // Player3: -18
      expect(ownerPlayer?.score).toBe(ownerScoreBefore + 32);
      expect(p2Player?.score).toBe(p2ScoreBefore - 14);
      expect(p3Player?.score).toBe(p3ScoreBefore - 18);
    });
  });

  // -------------------------------------------------------
  // 状態更新
  // -------------------------------------------------------
  describe("状態更新", () => {
    it("phaseがresultになる", async () => {
      const { room, owner, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      await setHand(owner, [testCards.red3]);

      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(room.state.phase).toBe("result");
    });

    it("GameResultがgameHistoryに追加される", async () => {
      const { room, owner, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      await setHand(owner, [testCards.red3]);

      const historyLengthBefore = room.state.gameHistory.length;

      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(room.state.gameHistory.length).toBe(historyLengthBefore + 1);

      const result = room.state.gameHistory[room.state.gameHistory.length - 1];
      expect(result.winnerId).toBe(owner.sessionId);
      expect(result.finishType).toBe("normal");
      expect(result.gameNumber).toBe(historyLengthBefore + 1);
    });

    it("nextGameStartPlayerIdが勝者に設定される", async () => {
      const { room, owner, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      await setHand(owner, [testCards.red3]);

      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(room.state.nextGameStartPlayerId).toBe(owner.sessionId);
    });

    it("rateMultiplierが1にリセットされる", async () => {
      const { room, owner, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // レート倍率を2に設定
      room.state.rateMultiplier = 2;
      room.state.consecutiveDeckouts = 1;

      await setHand(owner, [testCards.red3]);

      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(room.state.rateMultiplier).toBe(1);
      expect(room.state.consecutiveDeckouts).toBe(0);
    });
  });

  // -------------------------------------------------------
  // タイマー
  // -------------------------------------------------------
  describe("タイマー", () => {
    it("8秒後にphaseがwaitingになる（上がり表示3秒 + スコア表示5秒）", async () => {
      const { room, owner, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      await setHand(owner, [testCards.red3]);

      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(room.state.phase).toBe("result");

      // 8秒待つ
      await new Promise((resolve) => setTimeout(resolve, 8500));

      expect(room.state.phase).toBe("waiting");
    });

    it("8秒後にゲーム状態がリセットされる", async () => {
      const { room, owner, player2, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      await setHand(owner, [testCards.red3]);

      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 8秒待つ
      await new Promise((resolve) => setTimeout(resolve, 8500));

      // プレイヤーの手札がクリアされる
      const ownerPlayer = room.state.players.get(owner.sessionId);
      const p2Player = room.state.players.get(player2.sessionId);
      expect(ownerPlayer?.handCount).toBe(0);
      expect(ownerPlayer?.myHand.length).toBe(0);
      expect(p2Player?.handCount).toBe(0);
      expect(p2Player?.myHand.length).toBe(0);

      // ゲーム状態がリセットされる
      expect(room.state.fieldCards.length).toBe(0);
      expect(room.state.currentTurnPlayerId).toBe("");
      expect(room.state.drawStack).toBe(0);
    });
  });
});
