import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import appConfig from "../app.config";

type CardData = { id: string; color: string; value: string; points: number };

// テスト用カードデータ
const testCards = {
  red5: { id: "r5", color: "red", value: "5", points: 5 },
  red3: { id: "r3", color: "red", value: "3", points: 3 },
  blue3: { id: "b3", color: "blue", value: "3", points: 3 },
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
  remainingDeck: CardData[] = [],
) {
  const deck: CardData[] = [];

  // 残りのデッキ（山札として使われる）
  if (remainingDeck.length > 0) {
    deck.push(...remainingDeck);
  } else {
    for (let i = 0; i < 80; i++) {
      deck.push(createDummyCard(i));
    }
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

describe("DrawCardCommand", () => {
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
    remainingDeck: CardData[] = [],
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
      remainingDeck,
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
  // バリデーション
  // -------------------------------------------------------
  describe("バリデーション", () => {
    it("canDraw=false の場合は拒否される", async () => {
      const { room, player2 } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // player2は手番ではないのでcanDraw=false
      const p2Player = room.state.players.get(player2.sessionId);
      expect(p2Player?.canDraw).toBe(false);

      const deckCountBefore = room.state.deckCount;

      player2.send("drawCard");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 拒否されるのでデッキ枚数は変わらない
      expect(room.state.deckCount).toBe(deckCountBefore);
    });

    it("canDraw=true の場合は許可される", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // ownerは手番なのでcanDraw=true
      const ownerPlayer = room.state.players.get(owner.sessionId);
      expect(ownerPlayer?.canDraw).toBe(true);

      const deckCountBefore = room.state.deckCount;

      owner.send("drawCard");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 許可されるのでデッキ枚数が1減る
      expect(room.state.deckCount).toBe(deckCountBefore - 1);
    });
  });

  // -------------------------------------------------------
  // 実行
  // -------------------------------------------------------
  describe("実行", () => {
    it("山札から1枚引いて手札に追加される", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      const ownerPlayer = room.state.players.get(owner.sessionId);
      const handCountBefore = ownerPlayer?.handCount || 0;

      owner.send("drawCard");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(ownerPlayer?.handCount).toBe(handCountBefore + 1);
    });

    it("handCountが1増加する", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      const ownerPlayer = room.state.players.get(owner.sessionId);
      expect(ownerPlayer?.handCount).toBe(7);

      owner.send("drawCard");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(ownerPlayer?.handCount).toBe(8);
    });

    it("deckCountが1減少する", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      const deckCountBefore = room.state.deckCount;

      owner.send("drawCard");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(room.state.deckCount).toBe(deckCountBefore - 1);
    });

    it("hasDrawnThisTurn=true になる", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      expect(room.state.hasDrawnThisTurn).toBe(false);

      owner.send("drawCard");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(room.state.hasDrawnThisTurn).toBe(true);
    });

    it("canDraw=false, canPass=true になる", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      const ownerPlayer = room.state.players.get(owner.sessionId);
      expect(ownerPlayer?.canDraw).toBe(true);
      expect(ownerPlayer?.canPass).toBe(false);

      owner.send("drawCard");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(ownerPlayer?.canDraw).toBe(false);
      expect(ownerPlayer?.canPass).toBe(true);
    });

    it("playableCardsが再計算される（引いたカードも含む）", async () => {
      // 場が赤5で、引くカードが赤3（出せるカード）の場合
      const drawableCard = testCards.red3;
      const { room, owner } = await setupWithHands(
        testCards.red5, // 場: 赤5
        [
          testCards.blue3, // 出せない
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
        // 山札は2枚以上必要（1枚だと引いた後に山札切れでplayableCardsがクリアされる）
        [createDummyCard(500), drawableCard],
      );

      const ownerPlayer = room.state.players.get(owner.sessionId);

      owner.send("drawCard");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 引いた赤3がplayableCardsに含まれる
      expect(ownerPlayer?.playableCards.has(drawableCard.id)).toBe(true);
    });

    it("手番プレイヤーは変わらない", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      expect(room.state.currentTurnPlayerId).toBe(owner.sessionId);

      owner.send("drawCard");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(room.state.currentTurnPlayerId).toBe(owner.sessionId);
    });
  });

  // -------------------------------------------------------
  // 山札切れ
  // -------------------------------------------------------
  describe("山札切れ", () => {
    it("最後の1枚を引いた場合、ゲームが終了する（phase=result）", async () => {
      // 山札が1枚だけのデッキを作成
      const lastCard = testCards.red3;
      const { room, owner } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
        [lastCard], // 山札は1枚だけ
      );

      expect(room.state.deckCount).toBe(1);

      owner.send("drawCard");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.deckCount).toBe(0);
      expect(room.state.phase).toBe("result");
    });
  });
});
