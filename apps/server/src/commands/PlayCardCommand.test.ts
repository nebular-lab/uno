import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bootTestServer } from "../test/setup";

// テスト用カードデータ
const testCards = {
  // 数字カード
  red5: { id: "r5", color: "red", value: "5", points: 5 },
  red5_2: { id: "r5-2", color: "red", value: "5", points: 5 },
  red3: { id: "r3", color: "red", value: "3", points: 3 },
  blue3: { id: "b3", color: "blue", value: "3", points: 3 },
  green7: { id: "g7", color: "green", value: "7", points: 7 },
  // 記号カード
  redSkip: { id: "r-skip", color: "red", value: "skip", points: 20 },
  redSkip2: { id: "r-skip-2", color: "red", value: "skip", points: 20 },
  redReverse: { id: "r-reverse", color: "red", value: "reverse", points: 20 },
  redDraw2: { id: "r-draw2", color: "red", value: "draw2", points: 20 },
  redDraw2_2: { id: "r-draw2-2", color: "red", value: "draw2", points: 20 },
  // ワイルドカード
  wild: { id: "wild-1", color: "wild", value: "wild", points: 30 },
  wild2: { id: "wild-2", color: "wild", value: "wild", points: 30 },
  draw4: { id: "draw4-1", color: "wild", value: "draw4", points: 50 },
  draw4_2: { id: "draw4-2", color: "wild", value: "draw4", points: 50 },
  // 強制色変え
  forceRed: {
    id: "force-red",
    color: "red",
    value: "force-change",
    points: 10,
  },
  forceBlue: {
    id: "force-blue",
    color: "blue",
    value: "force-change",
    points: 10,
  },
  forceGreen: {
    id: "force-green",
    color: "green",
    value: "force-change",
    points: 10,
  },
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

describe("PlayCardCommand", () => {
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

  // ヘルパー: ダミー手札でplayingフェーズまで進める（将来使用予定）
  async function _setupWithFirstCard(firstCard: CardData) {
    return setupWithHands(
      firstCard,
      dummyHand(100),
      dummyHand(200),
      dummyHand(300),
    );
  }

  // -------------------------------------------------------
  // バリデーション
  // -------------------------------------------------------
  describe("バリデーション", () => {
    it("playing以外のフェーズでは拒否される", async () => {
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

    it("playableCardsに含まれていないカードは拒否される", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5, // 場: 赤5
        [
          testCards.blue3, // 出せない
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      const currentPlayer = room.state.players.get(owner.sessionId);
      expect(currentPlayer?.playableCards.has(testCards.blue3.id)).toBe(false);

      const fieldCardsBefore = room.state.fieldCards.length;

      owner.send("playCard", { cardIds: [testCards.blue3.id] });
      await new Promise((resolve) => setTimeout(resolve, 50));

      // カードは出されていない
      expect(room.state.fieldCards.length).toBe(fieldCardsBefore);
    });

    it("重ね出しで記号カード上がりは拒否される", async () => {
      const { room, owner, setHand } = await setupWithHands(
        testCards.redSkip, // 場: 赤スキップ
        dummyHand(100), // 初期手札（後で上書き）
        dummyHand(200),
        dummyHand(300),
      );

      // 手札を2枚だけに設定
      await setHand(owner, [testCards.redSkip2, testCards.redSkip]);

      const currentPlayer = room.state.players.get(owner.sessionId);
      // 手札2枚で1枚目は出せる
      expect(currentPlayer?.playableCards.has(testCards.redSkip2.id)).toBe(
        true,
      );
      expect(currentPlayer?.handCount).toBe(2);

      // 2枚同時に出す（記号で上がろうとする）
      owner.send("playCard", {
        cardIds: [testCards.redSkip2.id, testCards.redSkip.id],
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 拒否されるので手札は減らない
      expect(currentPlayer?.handCount).toBe(2);
    });
  });

  // -------------------------------------------------------
  // 実行
  // -------------------------------------------------------
  describe("実行", () => {
    it("カードが手札から場に移動する", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5, // 場: 赤5
        [
          testCards.red3, // 出せる（同色）
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      const currentPlayer = room.state.players.get(owner.sessionId);
      expect(currentPlayer?.playableCards.has(testCards.red3.id)).toBe(true);

      const fieldCardsBefore = room.state.fieldCards.length;

      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 場にカードが追加される
      expect(room.state.fieldCards.length).toBe(fieldCardsBefore + 1);
      const lastFieldCard =
        room.state.fieldCards[room.state.fieldCards.length - 1];
      expect(lastFieldCard.id).toBe(testCards.red3.id);
    });

    it("handCountが正しく更新される", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        [
          testCards.red3,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      const currentPlayer = room.state.players.get(owner.sessionId);
      const handCountBefore = currentPlayer?.handCount || 0;

      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(currentPlayer?.handCount).toBe(handCountBefore - 1);
    });

    it("次のプレイヤーに手番が移る", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        [
          testCards.red3,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      expect(room.state.currentTurnPlayerId).toBe(owner.sessionId);

      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.currentTurnPlayerId).not.toBe(owner.sessionId);
    });
  });

  // -------------------------------------------------------
  // カード種別ごと
  // -------------------------------------------------------
  describe("カード種別ごと", () => {
    it("数字カード: 色が変わる", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        [
          testCards.blue3,
          { id: "b5", color: "blue", value: "5", points: 5 }, // 同数字で出せる
          ...Array.from({ length: 5 }, (_, i) => createDummyCard(102 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      owner.send("playCard", { cardIds: ["b5"] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.currentColor).toBe("blue");
    });

    it("スキップ: 次のプレイヤーがスキップされる", async () => {
      const { room, owner, player3 } = await setupWithHands(
        testCards.red5,
        [
          testCards.redSkip,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      expect(room.state.currentTurnPlayerId).toBe(owner.sessionId);

      owner.send("playCard", { cardIds: [testCards.redSkip.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Player2がスキップされてPlayer3に
      expect(room.state.currentTurnPlayerId).toBe(player3.sessionId);
    });

    it("リバース: 進行方向が逆になる", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        [
          testCards.redReverse,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      expect(room.state.turnDirection).toBe(1);

      owner.send("playCard", { cardIds: [testCards.redReverse.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.turnDirection).toBe(-1);
    });

    it("ドロー2: drawStackが2になる", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        [
          testCards.redDraw2,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      expect(room.state.drawStack).toBe(0);

      owner.send("playCard", { cardIds: [testCards.redDraw2.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.drawStack).toBe(2);
    });

    it("ワイルド: 色選択待ち状態になり、手番は移動しない", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        [
          testCards.wild,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      expect(room.state.waitingForColorChoice).toBe(false);
      const originalTurnPlayer = room.state.currentTurnPlayerId;

      owner.send("playCard", { cardIds: [testCards.wild.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.waitingForColorChoice).toBe(true);
      // 手番は移動せず、カードを出したプレイヤーが色を選択する
      expect(room.state.currentTurnPlayerId).toBe(originalTurnPlayer);
      // 色選択可能フラグが立っている
      const ownerPlayer = room.state.players.get(owner.sessionId);
      expect(ownerPlayer?.canChooseColor).toBe(true);
    });

    it("ドロー4: drawStackが4になり色選択待ち状態になり、手番は移動しない", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        [
          testCards.draw4,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      const originalTurnPlayer = room.state.currentTurnPlayerId;

      owner.send("playCard", { cardIds: [testCards.draw4.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.drawStack).toBe(4);
      expect(room.state.waitingForColorChoice).toBe(true);
      // 手番は移動せず、カードを出したプレイヤーが色を選択する
      expect(room.state.currentTurnPlayerId).toBe(originalTurnPlayer);
      // 色選択可能フラグが立っている
      const ownerPlayer = room.state.players.get(owner.sessionId);
      expect(ownerPlayer?.canChooseColor).toBe(true);
    });

    it("強制色変え: カードの色が現在の色になる", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        [
          testCards.forceBlue,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      expect(room.state.currentColor).toBe("red");

      owner.send("playCard", { cardIds: [testCards.forceBlue.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.currentColor).toBe("blue");
      expect(room.state.waitingForColorChoice).toBe(false);
    });
  });

  // -------------------------------------------------------
  // 特殊ケース
  // -------------------------------------------------------
  describe("特殊ケース", () => {
    it("カットイン: 非手番プレイヤーが同じカードを出せる", async () => {
      const { room, owner, player2 } = await setupWithHands(
        testCards.red5, // 場: 赤5
        dummyHand(100),
        [
          testCards.red5_2, // 同じカード
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(201 + i)),
        ],
        dummyHand(300),
      );

      expect(room.state.currentTurnPlayerId).toBe(owner.sessionId);

      // Player2がカットイン
      const p2Player = room.state.players.get(player2.sessionId);
      expect(p2Player?.playableCards.has(testCards.red5_2.id)).toBe(true);

      player2.send("playCard", { cardIds: [testCards.red5_2.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // カードが出される
      const lastFieldCard =
        room.state.fieldCards[room.state.fieldCards.length - 1];
      expect(lastFieldCard.id).toBe(testCards.red5_2.id);
    });

    it("重ね出し（同色・同数字）: 2枚同時に出せる", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        [
          testCards.red5_2, // 同じカード2枚
          { id: "r5-3", color: "red", value: "5", points: 5 },
          ...Array.from({ length: 5 }, (_, i) => createDummyCard(102 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      const currentPlayer = room.state.players.get(owner.sessionId);
      const handCountBefore = currentPlayer?.handCount || 0;
      const fieldCardsBefore = room.state.fieldCards.length;

      owner.send("playCard", { cardIds: [testCards.red5_2.id, "r5-3"] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 2枚減る
      expect(currentPlayer?.handCount).toBe(handCountBefore - 2);
      // 場に2枚追加
      expect(room.state.fieldCards.length).toBe(fieldCardsBefore + 2);
    });

    it("重ね出し（強制色変え）: 色違いでも出せる", async () => {
      const { room, owner } = await setupWithHands(
        testCards.red5,
        [
          testCards.forceRed,
          testCards.forceBlue,
          testCards.forceGreen,
          ...Array.from({ length: 4 }, (_, i) => createDummyCard(103 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      const currentPlayer = room.state.players.get(owner.sessionId);
      const handCountBefore = currentPlayer?.handCount || 0;

      // 色違いの強制色変えを重ね出し
      owner.send("playCard", {
        cardIds: [
          testCards.forceRed.id,
          testCards.forceBlue.id,
          testCards.forceGreen.id,
        ],
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 3枚減る
      expect(currentPlayer?.handCount).toBe(handCountBefore - 3);
      // 最初に選んだカードの色になる
      expect(room.state.currentColor).toBe("red");
    });
  });

  // -------------------------------------------------------
  // 上がり
  // -------------------------------------------------------
  describe("上がり", () => {
    it("数字カードで上がり: 手札が0枚になる", async () => {
      const { room, owner, setHand } = await setupWithHands(
        testCards.red5, // 場: 赤5
        dummyHand(100), // デッキ用（あとで上書き）
        dummyHand(200),
        dummyHand(300),
      );

      // 手札を1枚だけに設定
      await setHand(owner, [testCards.red3]);

      const currentPlayer = room.state.players.get(owner.sessionId);
      expect(currentPlayer?.handCount).toBe(1);

      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(currentPlayer?.handCount).toBe(0);
    });

    it("数字カードの重ね出しで上がり: 同じ数字2枚で上がれる", async () => {
      const { room, owner, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100), // デッキ用（あとで上書き）
        dummyHand(200),
        dummyHand(300),
      );

      // 手札を2枚だけに設定
      await setHand(owner, [
        testCards.red5_2,
        { id: "r5-dup", color: "red", value: "5", points: 5 },
      ]);

      const currentPlayer = room.state.players.get(owner.sessionId);
      expect(currentPlayer?.handCount).toBe(2);

      owner.send("playCard", { cardIds: [testCards.red5_2.id, "r5-dup"] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(currentPlayer?.handCount).toBe(0);
    });

    it("上がり時に他のプレイヤーがドボン可能になる（手札合計が出したカードの点数と一致）", async () => {
      // Player1が赤3（3点）で上がり → Player2の手札合計が3点ならドボン可能
      const { room, owner, player2, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100), // デッキ用（あとで上書き）
        dummyHand(200),
        dummyHand(300),
      );

      // Ownerの手札を1枚に設定
      await setHand(owner, [testCards.red3]);
      // Player2の手札を合計3点に設定
      await setHand(player2, [
        { id: "p2-1", color: "blue", value: "1", points: 1 },
        { id: "p2-2", color: "blue", value: "2", points: 2 },
      ]);

      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const p2Player = room.state.players.get(player2.sessionId);
      expect(p2Player?.canDobon).toBe(true);
    });

    it("上がり時にドボン不可能なプレイヤーはcanDobon=false", async () => {
      const { room, owner, player2, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100), // デッキ用（あとで上書き）
        dummyHand(200),
        dummyHand(300),
      );

      // Ownerの手札を1枚に設定
      await setHand(owner, [testCards.red3]);
      // Player2の手札を合計12点に設定
      await setHand(player2, [
        { id: "p2-1", color: "blue", value: "5", points: 5 },
        { id: "p2-2", color: "blue", value: "7", points: 7 },
      ]);

      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const p2Player = room.state.players.get(player2.sessionId);
      expect(p2Player?.canDobon).toBe(false);
    });
  });

  // -------------------------------------------------------
  // ドボン判定
  // -------------------------------------------------------
  describe("ドボン判定", () => {
    it("カードを出した後、他のプレイヤーのcanDobonが更新される", async () => {
      // Player1が赤5（5点）を出す → Player2の手札合計が5点ならドボン可能
      const { room, owner, player2, setHand } = await setupWithHands(
        testCards.red3, // 場: 赤3
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // Ownerの手札を設定（赤5を含む7枚）
      await setHand(owner, [
        testCards.red5, // 赤5を出す
        ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
      ]);
      // Player2の手札を合計5点に設定
      await setHand(player2, [
        { id: "p2-3", color: "blue", value: "3", points: 3 },
        { id: "p2-2", color: "blue", value: "2", points: 2 },
      ]);

      owner.send("playCard", { cardIds: [testCards.red5.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const p2Player = room.state.players.get(player2.sessionId);
      expect(p2Player?.canDobon).toBe(true);
    });

    it("重ね出しの場合は合計点数でドボン判定", async () => {
      // Player1が赤5×2枚（10点）を出す → Player2の手札合計が10点ならドボン可能
      const { room, owner, player2, setHand } = await setupWithHands(
        testCards.red5, // 場: 赤5
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // Ownerの手札を設定（赤5×2枚を含む7枚）
      await setHand(owner, [
        testCards.red5_2,
        { id: "r5-3", color: "red", value: "5", points: 5 },
        ...Array.from({ length: 5 }, (_, i) => createDummyCard(102 + i)),
      ]);
      // Player2の手札を合計10点に設定
      await setHand(player2, [
        { id: "p2-5", color: "blue", value: "5", points: 5 },
        { id: "p2-5b", color: "green", value: "5", points: 5 },
      ]);

      owner.send("playCard", { cardIds: [testCards.red5_2.id, "r5-3"] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const p2Player = room.state.players.get(player2.sessionId);
      expect(p2Player?.canDobon).toBe(true);
    });

    it("記号カードでもドボン可能（手札に記号カードが含まれていても可）", async () => {
      // Player1がドロー2（20点）を出す → Player2の手札合計が20点ならドボン可能
      const { room, owner, player2, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // Ownerの手札を設定（ドロー2を含む7枚）
      await setHand(owner, [
        testCards.redDraw2, // 20点
        ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
      ]);
      // Player2の手札を合計20点に設定
      await setHand(player2, [testCards.redSkip]); // 20点（記号カード）

      owner.send("playCard", { cardIds: [testCards.redDraw2.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const p2Player = room.state.players.get(player2.sessionId);
      expect(p2Player?.canDobon).toBe(true);
    });

    it("複数プレイヤーが同時にドボン可能", async () => {
      // Player1が赤5（5点）を出す → Player2とPlayer3の両方が手札合計5点
      const { room, owner, player2, player3, setHand } = await setupWithHands(
        testCards.red3,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // Ownerの手札を設定
      await setHand(owner, [
        testCards.red5,
        ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
      ]);
      // Player2の手札を合計5点に設定
      await setHand(player2, [
        { id: "p2-3", color: "blue", value: "3", points: 3 },
        { id: "p2-2", color: "blue", value: "2", points: 2 },
      ]);
      // Player3の手札を合計5点に設定
      await setHand(player3, [
        { id: "p3-4", color: "green", value: "4", points: 4 },
        { id: "p3-1", color: "green", value: "1", points: 1 },
      ]);

      owner.send("playCard", { cardIds: [testCards.red5.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const p2Player = room.state.players.get(player2.sessionId);
      const p3Player = room.state.players.get(player3.sessionId);
      expect(p2Player?.canDobon).toBe(true);
      expect(p3Player?.canDobon).toBe(true);
    });

    it("手番プレイヤーもドボン可能（場のカードに対して）", async () => {
      // ゲーム開始時、場の赤5に対してOwnerの手札合計が5点ならドボン可能
      const { room, owner, setHand } = await setupWithHands(
        testCards.red5, // 場: 赤5（5点）
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // Ownerの手札を合計5点に設定
      await setHand(owner, [
        { id: "o-3", color: "blue", value: "3", points: 3 },
        { id: "o-2", color: "blue", value: "2", points: 2 },
      ]);

      const ownerPlayer = room.state.players.get(owner.sessionId);
      expect(ownerPlayer?.canDobon).toBe(true);
    });

    it("自分が出したカードに対してはドボンできない", async () => {
      // Player1が赤5（5点）を出す → Player1自身はドボン不可、Player2はドボン可能
      const { room, owner, player2, setHand } = await setupWithHands(
        testCards.red3, // 場: 赤3
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // Ownerの手札を設定（赤5を含む、残り合計5点）
      await setHand(owner, [
        testCards.red5, // 赤5を出す（5点）
        { id: "o-3", color: "blue", value: "3", points: 3 },
        { id: "o-2", color: "blue", value: "2", points: 2 },
      ]);
      // Player2の手札を合計5点に設定
      await setHand(player2, [
        { id: "p2-3", color: "blue", value: "3", points: 3 },
        { id: "p2-2", color: "blue", value: "2", points: 2 },
      ]);

      owner.send("playCard", { cardIds: [testCards.red5.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const ownerPlayer = room.state.players.get(owner.sessionId);
      const p2Player = room.state.players.get(player2.sessionId);
      // カードを出したプレイヤー自身はドボン不可
      expect(ownerPlayer?.canDobon).toBe(false);
      // 他のプレイヤーはドボン可能
      expect(p2Player?.canDobon).toBe(true);
    });
  });

  // -------------------------------------------------------
  // ドロースタック累積
  // -------------------------------------------------------
  describe("ドロースタック累積", () => {
    it("前のプレイヤーが+2を出した後に+2を出すと、drawStackが4になる", async () => {
      const { room, owner, player2, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // Ownerの手札にdraw2を設定
      await setHand(owner, [
        testCards.redDraw2,
        ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
      ]);
      // Player2の手札にdraw2を設定
      await setHand(player2, [
        testCards.redDraw2_2,
        ...Array.from({ length: 6 }, (_, i) => createDummyCard(201 + i)),
      ]);

      // Owner が draw2 を出す
      owner.send("playCard", { cardIds: [testCards.redDraw2.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(room.state.drawStack).toBe(2);

      // デバッグ: Player2のplayableCardsを確認
      const p2Player = room.state.players.get(player2.sessionId);
      console.log(
        "DEBUG: Player2 playableCards:",
        Array.from(p2Player?.playableCards?.keys() || []),
      );
      console.log("DEBUG: Player2 canDrawStack:", p2Player?.canDrawStack);
      console.log(
        "DEBUG: currentTurn is Player2:",
        room.state.currentTurnPlayerId === player2.sessionId,
      );
      const lastFieldCard =
        room.state.fieldCards[room.state.fieldCards.length - 1];
      console.log("DEBUG: fieldCard:", lastFieldCard?.id, lastFieldCard?.value);

      // Player2 が draw2 を重ねる
      player2.send("playCard", { cardIds: [testCards.redDraw2_2.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(room.state.drawStack).toBe(4);
    });

    it("前のプレイヤーが+2を出した後に+4を出すと、drawStackが6になる", async () => {
      const { room, owner, player2, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // Ownerの手札にdraw2を設定
      await setHand(owner, [
        testCards.redDraw2,
        ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
      ]);
      // Player2の手札にdraw4を設定
      await setHand(player2, [
        testCards.draw4,
        ...Array.from({ length: 6 }, (_, i) => createDummyCard(201 + i)),
      ]);

      // Owner が draw2 を出す
      owner.send("playCard", { cardIds: [testCards.redDraw2.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(room.state.drawStack).toBe(2);

      // Player2 が draw4 を重ねる（色選択待ちになる）
      player2.send("playCard", { cardIds: [testCards.draw4.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(room.state.drawStack).toBe(6);
      expect(room.state.waitingForColorChoice).toBe(true);
    });

    it("前のプレイヤーが+2を出した後に+2を2枚重ねて出すと、drawStackが6になる", async () => {
      const { room, owner, player2, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // Ownerの手札にdraw2を設定
      await setHand(owner, [
        testCards.redDraw2,
        ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
      ]);
      // Player2の手札にdraw2を2枚設定
      await setHand(player2, [
        testCards.redDraw2_2,
        { id: "r-draw2-3", color: "red", value: "draw2", points: 20 },
        ...Array.from({ length: 5 }, (_, i) => createDummyCard(202 + i)),
      ]);

      // Owner が draw2 を出す
      owner.send("playCard", { cardIds: [testCards.redDraw2.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(room.state.drawStack).toBe(2);

      // Player2 が draw2 を2枚重ねて出す
      player2.send("playCard", {
        cardIds: [testCards.redDraw2_2.id, "r-draw2-3"],
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(room.state.drawStack).toBe(6);
    });
  });

  // -------------------------------------------------------
  // カットイン制限
  // -------------------------------------------------------
  describe("カットイン制限", () => {
    it("上がりカードにはカットインできない（playableCardsが空になる）", async () => {
      // Player1が上がる → Player2は同じカードを持っていてもカットインできない
      // Player2の初期手札に赤3を含める（カットイン可能な状態を作る）
      const { room, owner, player2, setHand } = await setupWithHands(
        testCards.red5, // 場: 赤5
        dummyHand(100), // Owner: 7枚（後で上書き）
        [
          { id: "p2-r3", color: "red", value: "3", points: 3 }, // 赤3（カットイン可能）
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(201 + i)),
        ],
        dummyHand(300),
      );

      // Ownerの手札を1枚だけに設定（上がり用）
      await setHand(owner, [testCards.red3]);

      const ownerPlayer = room.state.players.get(owner.sessionId);
      expect(ownerPlayer?.handCount).toBe(1);

      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Ownerが上がり
      expect(ownerPlayer?.handCount).toBe(0);

      const p2Player = room.state.players.get(player2.sessionId);

      // 上がりカードにはカットインできないのでplayableCardsは空
      expect(p2Player?.playableCards.size).toBe(0);
    });
  });
});
