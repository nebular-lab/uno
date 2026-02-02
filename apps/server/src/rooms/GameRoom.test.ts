import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bootTestServer } from "../test/setup";

type CardData = { id: string; color: string; value: string; points: number };

// テスト用カードデータ
const testCards = {
  red5: { id: "r5", color: "red", value: "5", points: 5 },
  red3: { id: "r3", color: "red", value: "3", points: 3 },
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

describe("GameRoom", () => {
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
  // resetGameState
  // -------------------------------------------------------
  describe("resetGameState", () => {
    it("プレイヤーの手札がクリアされる", async () => {
      const { room, owner, player2, player3, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // 上がり処理を実行
      await setHand(owner, [testCards.red3]);
      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(room.state.phase).toBe("result");

      // 3秒待ってリセットされるのを待つ
      await new Promise((resolve) => setTimeout(resolve, 3500));

      // 全プレイヤーの手札がクリアされている
      const ownerPlayer = room.state.players.get(owner.sessionId);
      const p2Player = room.state.players.get(player2.sessionId);
      const p3Player = room.state.players.get(player3.sessionId);

      expect(ownerPlayer?.myHand.length).toBe(0);
      expect(ownerPlayer?.handCount).toBe(0);
      expect(p2Player?.myHand.length).toBe(0);
      expect(p2Player?.handCount).toBe(0);
      expect(p3Player?.myHand.length).toBe(0);
      expect(p3Player?.handCount).toBe(0);
    });

    it("ゲーム状態がリセットされる", async () => {
      const { room, owner, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // 上がり処理を実行
      await setHand(owner, [testCards.red3]);
      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(room.state.phase).toBe("result");

      // 3秒待ってリセットされるのを待つ
      await new Promise((resolve) => setTimeout(resolve, 3500));

      // ゲーム状態がリセットされている
      expect(room.state.phase).toBe("waiting");
      expect(room.state.fieldCards.length).toBe(0);
      expect(room.state.deckCount).toBe(0);
      expect(room.state.currentColor).toBe("");
      expect(room.state.currentTurnPlayerId).toBe("");
      expect(room.state.turnDirection).toBe(1);
      expect(room.state.drawStack).toBe(0);
      expect(room.state.waitingForColorChoice).toBe(false);
      expect(room.state.hasDrawnThisTurn).toBe(false);
    });

    it("プレイヤーのアクションフラグがリセットされる", async () => {
      const { room, owner, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // 上がり処理を実行
      await setHand(owner, [testCards.red3]);
      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 3秒待ってリセットされるのを待つ
      await new Promise((resolve) => setTimeout(resolve, 3500));

      // 全プレイヤーのアクションフラグがリセットされている
      for (const player of room.state.players.values()) {
        expect(player.canPass).toBe(false);
        expect(player.canDraw).toBe(false);
        expect(player.canChooseColor).toBe(false);
        expect(player.canDobon).toBe(false);
        expect(player.canDobonReturn).toBe(false);
        expect(player.canDrawStack).toBe(false);
        expect(player.playableCards.size).toBe(0);
        expect(player.timeRemaining).toBe(0);
      }
    });
  });
});
