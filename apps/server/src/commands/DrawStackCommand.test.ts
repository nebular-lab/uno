import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bootTestServer } from "../test/setup";

type CardData = { id: string; color: string; value: string; points: number };

// テスト用カードデータ
const testCards = {
  red5: { id: "r5", color: "red", value: "5", points: 5 },
  red3: { id: "r3", color: "red", value: "3", points: 3 },
  redDraw2: { id: "r-draw2", color: "red", value: "draw2", points: 20 },
  redDraw2_2: { id: "r-draw2-2", color: "red", value: "draw2", points: 20 },
  draw4: { id: "draw4-1", color: "wild", value: "draw4", points: 50 },
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

describe("DrawStackCommand", () => {
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

    // 手札を設定するヘルパー
    const setHand = async (
      client: typeof owner,
      cards: CardData[],
    ): Promise<void> => {
      client.send("__setHand", cards);
      await new Promise((resolve) => setTimeout(resolve, 50));
    };

    return { room, owner, player2, player3, setHand };
  }

  // ヘルパー: drawStackが設定された状態を作る（Owner がドロー2を出し、Player2の手番になる）
  async function setupWithDrawStack(drawStackCount: number = 2) {
    const { room, owner, player2, player3, setHand } = await setupWithHands(
      testCards.red5,
      dummyHand(100),
      dummyHand(200),
      dummyHand(300),
    );

    // Ownerの手札にドロー2を設定
    await setHand(owner, [
      testCards.redDraw2,
      ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
    ]);

    // Ownerがドロー2を出す
    owner.send("playCard", { cardIds: [testCards.redDraw2.id] });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // drawStackが2になっていることを確認
    expect(room.state.drawStack).toBe(drawStackCount);
    // Player2の手番になっている
    expect(room.state.currentTurnPlayerId).toBe(player2.sessionId);

    return { room, owner, player2, player3, setHand };
  }

  // -------------------------------------------------------
  // バリデーション
  // -------------------------------------------------------
  describe("バリデーション", () => {
    it("canDrawStack=false の場合は拒否される", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // drawStack=0 なので canDrawStack=false
      expect(room.state.drawStack).toBe(0);
      const ownerPlayer = room.state.players.get(owner.sessionId);
      expect(ownerPlayer?.canDrawStack).toBe(false);

      const handCountBefore = ownerPlayer?.handCount || 0;

      owner.send("drawStack");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 拒否されるので手札は変わらない
      expect(ownerPlayer?.handCount).toBe(handCountBefore);
    });

    it("canDrawStack=true の場合は許可される", async () => {
      const { room, player2 } = await setupWithDrawStack();

      const p2Player = room.state.players.get(player2.sessionId);
      expect(p2Player?.canDrawStack).toBe(true);

      const handCountBefore = p2Player?.handCount || 0;

      player2.send("drawStack");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 許可されるので手札が増える
      expect(p2Player?.handCount).toBe(handCountBefore + 2);
    });

    it("手札にドローカードがあっても引くことを選択できる", async () => {
      const { room, player2, setHand } = await setupWithDrawStack();

      // Player2の手札にドロー2を設定（重ねることもできるがあえて引く）
      await setHand(player2, [
        testCards.redDraw2_2,
        ...Array.from({ length: 6 }, (_, i) => createDummyCard(201 + i)),
      ]);

      const p2Player = room.state.players.get(player2.sessionId);
      // ドロー2を重ねることもできる
      expect(p2Player?.playableCards.has(testCards.redDraw2_2.id)).toBe(true);
      // 引くこともできる
      expect(p2Player?.canDrawStack).toBe(true);

      const handCountBefore = p2Player?.handCount || 0;

      // あえて引くことを選択
      player2.send("drawStack");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 引いたので手札が2枚増える
      expect(p2Player?.handCount).toBe(handCountBefore + 2);
    });
  });

  // -------------------------------------------------------
  // 実行
  // -------------------------------------------------------
  describe("実行", () => {
    it("累積枚数分のカードを山札から引く", async () => {
      const { room, player2 } = await setupWithDrawStack();

      const p2Player = room.state.players.get(player2.sessionId);
      const handCountBefore = p2Player?.handCount || 0;

      player2.send("drawStack");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 2枚引く
      expect(p2Player?.handCount).toBe(handCountBefore + 2);
    });

    it("handCount が累積枚数分増加する", async () => {
      const { room, player2 } = await setupWithDrawStack();

      const p2Player = room.state.players.get(player2.sessionId);
      expect(p2Player?.handCount).toBe(7);

      player2.send("drawStack");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(p2Player?.handCount).toBe(9);
    });

    it("deckCount が累積枚数分減少する", async () => {
      const { room, player2 } = await setupWithDrawStack();

      const deckCountBefore = room.state.deckCount;

      player2.send("drawStack");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.deckCount).toBe(deckCountBefore - 2);
    });

    it("drawStack が 0 にリセットされる", async () => {
      const { room, player2 } = await setupWithDrawStack();

      expect(room.state.drawStack).toBe(2);

      player2.send("drawStack");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.drawStack).toBe(0);
    });

    it("次のプレイヤーに手番が移る", async () => {
      const { room, player2, player3 } = await setupWithDrawStack();

      expect(room.state.currentTurnPlayerId).toBe(player2.sessionId);

      player2.send("drawStack");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.currentTurnPlayerId).toBe(player3.sessionId);
    });

    it("hasDrawnThisTurn は false のまま", async () => {
      const { room, player2 } = await setupWithDrawStack();

      expect(room.state.hasDrawnThisTurn).toBe(false);

      player2.send("drawStack");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 累積ドローは任意ドローではないので false のまま
      expect(room.state.hasDrawnThisTurn).toBe(false);
    });

    it("canDrawStack=false, canDraw=true になる（次の手番プレイヤー）", async () => {
      const { room, player2, player3 } = await setupWithDrawStack();

      player2.send("drawStack");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 次の手番は Player3
      const p3Player = room.state.players.get(player3.sessionId);
      expect(p3Player?.canDrawStack).toBe(false);
      expect(p3Player?.canDraw).toBe(true);
    });

    it("playableCards が再計算される", async () => {
      const { room, player2, player3, setHand } = await setupWithDrawStack();

      // Player3の手札を設定（場のカードに対して出せるカード）
      await setHand(player3, [
        testCards.red3, // 場の色（赤）と同じなので出せる
        ...Array.from({ length: 6 }, (_, i) => createDummyCard(301 + i)),
      ]);

      player2.send("drawStack");
      await new Promise((resolve) => setTimeout(resolve, 100));

      const p3Player = room.state.players.get(player3.sessionId);
      expect(p3Player?.playableCards.has(testCards.red3.id)).toBe(true);
    });
  });

  // -------------------------------------------------------
  // 累積ドロー（4枚以上）
  // -------------------------------------------------------
  describe("累積ドロー（4枚以上）", () => {
    it("drawStack=4 の場合、4枚引く", async () => {
      const { room, owner, player2, player3, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // Ownerがドロー2を出す
      await setHand(owner, [
        testCards.redDraw2,
        ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
      ]);
      owner.send("playCard", { cardIds: [testCards.redDraw2.id] });
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Player2がドロー2を重ねる
      await setHand(player2, [
        testCards.redDraw2_2,
        ...Array.from({ length: 6 }, (_, i) => createDummyCard(201 + i)),
      ]);
      player2.send("playCard", { cardIds: [testCards.redDraw2_2.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.drawStack).toBe(4);
      expect(room.state.currentTurnPlayerId).toBe(player3.sessionId);

      const p3Player = room.state.players.get(player3.sessionId);
      const handCountBefore = p3Player?.handCount || 0;

      player3.send("drawStack");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(p3Player?.handCount).toBe(handCountBefore + 4);
      expect(room.state.drawStack).toBe(0);
    });
  });

  // -------------------------------------------------------
  // 山札切れ
  // -------------------------------------------------------
  describe("山札切れ", () => {
    it("累積分を引く途中で山札が切れた場合、引ける分だけ引いてゲーム終了", async () => {
      // 山札が1枚だけのデッキを作成
      const { room, owner, player2, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
        [createDummyCard(500)], // 山札は1枚だけ
      );

      // Ownerがドロー2を出す
      await setHand(owner, [
        testCards.redDraw2,
        ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
      ]);
      owner.send("playCard", { cardIds: [testCards.redDraw2.id] });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(room.state.drawStack).toBe(2);
      expect(room.state.deckCount).toBe(1);

      const p2Player = room.state.players.get(player2.sessionId);
      const handCountBefore = p2Player?.handCount || 0;

      player2.send("drawStack");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 引ける分だけ引く（1枚）
      expect(p2Player?.handCount).toBe(handCountBefore + 1);
      expect(room.state.deckCount).toBe(0);
      // ゲーム終了
      expect(room.state.phase).toBe("result");
    });

    it("累積分を全て引いた後に山札が0枚になった場合、ゲーム終了", async () => {
      // 山札が2枚だけのデッキを作成（drawStack=2 と一致）
      const { room, owner, player2, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
        [createDummyCard(500), createDummyCard(501)], // 山札は2枚
      );

      // Ownerがドロー2を出す
      await setHand(owner, [
        testCards.redDraw2,
        ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
      ]);
      owner.send("playCard", { cardIds: [testCards.redDraw2.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.drawStack).toBe(2);
      expect(room.state.deckCount).toBe(2);

      const p2Player = room.state.players.get(player2.sessionId);
      const handCountBefore = p2Player?.handCount || 0;

      player2.send("drawStack");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 2枚引く
      expect(p2Player?.handCount).toBe(handCountBefore + 2);
      expect(room.state.deckCount).toBe(0);
      // ゲーム終了
      expect(room.state.phase).toBe("result");
    });
  });

  // -------------------------------------------------------
  // 最初のカードがdraw4の場合
  // -------------------------------------------------------
  describe("最初のカードがdraw4の場合", () => {
    it("drawStack引いた後、次のプレイヤーはどんなカードでも出せる", async () => {
      // 最初のカードがdraw4
      const { room, owner, player2, setHand } = await setupWithHands(
        testCards.draw4,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // 最初のカードがdraw4なので、drawStack=4、currentColor=""
      expect(room.state.drawStack).toBe(4);
      expect(room.state.currentColor).toBe("");

      // Owner（最初のプレイヤー）がcanDrawStack=true
      const ownerPlayer = room.state.players.get(owner.sessionId);
      expect(ownerPlayer?.canDrawStack).toBe(true);

      // Ownerが4枚引く
      owner.send("drawStack");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Player2の手番になる
      expect(room.state.currentTurnPlayerId).toBe(player2.sessionId);
      expect(room.state.drawStack).toBe(0);
      // 色はまだ決まっていない
      expect(room.state.currentColor).toBe("");

      // Player2の手札に青カードを設定（draw4の色とは関係ない）
      const blueCard = { id: "blue7", color: "blue", value: "7", points: 7 };
      const greenCard = { id: "green3", color: "green", value: "3", points: 3 };
      await setHand(player2, [
        blueCard,
        greenCard,
        ...Array.from({ length: 5 }, (_, i) => createDummyCard(201 + i)),
      ]);

      const p2Player = room.state.players.get(player2.sessionId);
      // 色が未決定なので、どんなカードでも出せる
      expect(p2Player?.playableCards.has(blueCard.id)).toBe(true);
      expect(p2Player?.playableCards.has(greenCard.id)).toBe(true);
    });

    it("drawStack引いた後に出したカードの色がcurrentColorになる", async () => {
      const { room, owner, player2, setHand } = await setupWithHands(
        testCards.draw4,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // Ownerが4枚引く
      owner.send("drawStack");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Player2が青カードを出す
      const blueCard = { id: "blue7", color: "blue", value: "7", points: 7 };
      await setHand(player2, [
        blueCard,
        ...Array.from({ length: 6 }, (_, i) => createDummyCard(201 + i)),
      ]);

      player2.send("playCard", { cardIds: [blueCard.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // currentColorが青になる
      expect(room.state.currentColor).toBe("blue");
    });
  });
});
