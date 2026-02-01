import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TIMING } from "../config/timing";
import { bootTestServer } from "../test/setup";

// テスト用カードデータ
const testCards = {
  // 数字カード
  number: { id: "r5", color: "red", value: "5", points: 5 },
  number3: { id: "r3", color: "red", value: "3", points: 3 },
  number2: { id: "r2", color: "red", value: "2", points: 2 },
  red1: { id: "r1", color: "red", value: "1", points: 1 },
  red6: { id: "r6", color: "red", value: "6", points: 6 },
  blue2: { id: "b2", color: "blue", value: "2", points: 2 },
  green3: { id: "g3", color: "green", value: "3", points: 3 },
  yellow4: { id: "y4", color: "yellow", value: "4", points: 4 },
  // スキップ・リバース
  skip: { id: "r-skip", color: "red", value: "skip", points: 20 },
  skip2: { id: "r-skip-2", color: "red", value: "skip", points: 20 },
  reverse: { id: "r-reverse", color: "red", value: "reverse", points: 20 },
  reverse2: {
    id: "r-reverse-2",
    color: "red",
    value: "reverse",
    points: 20,
  },
  // ドロー2
  draw2: { id: "g-draw2", color: "green", value: "draw2", points: 20 },
  draw2_2: { id: "g-draw2-2", color: "green", value: "draw2", points: 20 },
  // ワイルド
  wild: { id: "wild-1", color: "wild", value: "wild", points: 30 },
  wild2: { id: "wild-2", color: "wild", value: "wild", points: 30 },
  // ドロー4
  draw4: { id: "draw4-1", color: "wild", value: "draw4", points: 50 },
  draw4_2: { id: "draw4-2", color: "wild", value: "draw4", points: 50 },
  draw4_3: { id: "draw4-3", color: "wild", value: "draw4", points: 50 },
  // 強制色変え
  forceChangeRed: {
    id: "force-red",
    color: "red",
    value: "force-change",
    points: 10,
  },
  forceChangeBlue: {
    id: "force-blue",
    color: "blue",
    value: "force-change",
    points: 10,
  },
  forceChangeGreen: {
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

// 0点カードを生成（ドボンテスト用）
function zeroCard(index: number): CardData {
  return { id: `zero-${index}`, color: "yellow", value: "0", points: 0 };
}

/**
 * プレイヤーごとの手札を指定してデッキを生成する
 * 配布順序を考慮して正しい位置にカードを配置
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
  // Round 7 → Round 1 の順で、各ラウンド P3, P2, P1 の順
  for (let round = 6; round >= 0; round--) {
    deck.push(player3Hand[round] || createDummyCard(300 + round));
    deck.push(player2Hand[round] || createDummyCard(200 + round));
    deck.push(player1Hand[round] || createDummyCard(100 + round));
  }

  return deck;
}

describe("BeginPlayCommand", () => {
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
    options: { turnTimeout?: number } = {},
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

    // タイマーテスト用にタイムアウト時間を設定（ゲーム開始前に設定する必要がある）
    if (options.turnTimeout !== undefined) {
      owner.send("__setTurnTimeout", options.turnTimeout);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    owner.send("startGame");

    const timeout = Date.now() + 15000;
    while (room.state.phase !== "playing" && Date.now() < timeout) {
      await room.waitForNextPatch();
    }

    return { room, owner, player2, player3 };
  }

  // ヘルパー: ダミー手札でplayingフェーズまで進める
  async function setupWithFirstCard(firstCard: CardData) {
    return setupWithHands(
      firstCard,
      dummyHand(100),
      dummyHand(200),
      dummyHand(300),
    );
  }

  // -------------------------------------------------------
  // フェーズ移行
  // -------------------------------------------------------
  describe("フェーズ移行", () => {
    it("最終的にplayingフェーズになる", async () => {
      const { room } = await setupWithFirstCard(testCards.number);
      expect(room.state.phase).toBe("playing");
    });

    it("revealingフェーズからplayingフェーズへ移行する", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");

      let sawRevealing = false;
      const timeout = Date.now() + 15000;
      while (room.state.phase !== "playing" && Date.now() < timeout) {
        if (room.state.phase === "revealing") {
          sawRevealing = true;
        }
        await room.waitForNextPatch();
      }

      expect(sawRevealing).toBe(true);
      expect(room.state.phase).toBe("playing");
    });
  });

  // -------------------------------------------------------
  // 最初のカードが数字カードの場合
  // -------------------------------------------------------
  describe("最初のカードが数字カードの場合", () => {
    it("効果: 手番プレイヤーのcanDrawがtrue、canPassはfalse", async () => {
      const { room } = await setupWithFirstCard(testCards.number);

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.canDraw).toBe(true);
      expect(currentPlayer?.canPass).toBe(false);
    });

    it("効果: 手番でないプレイヤーの基本アクションがすべてfalse", async () => {
      const { room } = await setupWithFirstCard(testCards.number);

      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          expect(player.canDraw).toBe(false);
          expect(player.canDrawStack).toBe(false);
          expect(player.canChooseColor).toBe(false);
          expect(player.canPass).toBe(false);
          expect(player.canDobonReturn).toBe(false);
        }
      }
    });

    it("出せるカード: 手番プレイヤーにplayableCardsが設定される", async () => {
      const { room } = await setupWithFirstCard(testCards.number);

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.playableCards).toBeDefined();
    });

    it("カットイン: 同じカードを持つ非手番プレイヤーがカットインできる", async () => {
      const { room } = await setupWithHands(
        testCards.number, // 赤5
        dummyHand(100),
        [
          testCards.number,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(201 + i)),
        ],
        dummyHand(300),
      );

      let foundCutIn = false;
      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          for (const card of player.myHand) {
            if (card.color === "red" && card.value === "5") {
              expect(player.playableCards.has(card.id)).toBe(true);
              foundCutIn = true;
            }
          }
        }
      }
      expect(foundCutIn).toBe(true);
    });

    it("カットイン: 同じカードを持たない非手番プレイヤーはカットインできない", async () => {
      const { room } = await setupWithHands(
        testCards.number, // 赤5
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          let hasSameCard = false;
          for (const card of player.myHand) {
            if (card.color === "red" && card.value === "5") {
              hasSameCard = true;
            }
          }
          if (!hasSameCard) {
            expect(player.playableCards.size).toBe(0);
          }
        }
      }
    });

    it("ドボン: 手札合計が場札の点数(5)と一致すればcanDobonがtrue", async () => {
      // 場札: 赤5 (5点), P1手札: 3+2+0+0+0+0+0 = 5点
      const { room } = await setupWithHands(
        testCards.number,
        [
          testCards.number3,
          testCards.number2,
          zeroCard(1),
          zeroCard(2),
          zeroCard(3),
          zeroCard(4),
          zeroCard(5),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.canDobon).toBe(true);
    });

    it("ドボン: 手札合計が不一致ならcanDobonがfalse", async () => {
      // 場札: 赤5 (5点), P1手札: 3+3+0+0+0+0+0 = 6点
      const { room } = await setupWithHands(
        testCards.number,
        [
          testCards.number3,
          { id: "r3-2", color: "red", value: "3", points: 3 },
          zeroCard(1),
          zeroCard(2),
          zeroCard(3),
          zeroCard(4),
          zeroCard(5),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.canDobon).toBe(false);
    });

    it("ドボン: 手番でないプレイヤーもドボン可能", async () => {
      // 場札: 赤5 (5点), P2手札: 3+2+0+0+0+0+0 = 5点
      const { room } = await setupWithHands(
        testCards.number,
        [
          { id: "y9", color: "yellow", value: "9", points: 9 },
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
        ],
        [
          testCards.number3,
          testCards.number2,
          zeroCard(1),
          zeroCard(2),
          zeroCard(3),
          zeroCard(4),
          zeroCard(5),
        ],
        dummyHand(300),
      );

      let foundDobon = false;
      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          let total = 0;
          for (const card of player.myHand) total += card.points;
          if (total === 5) {
            expect(player.canDobon).toBe(true);
            foundDobon = true;
          }
        }
      }
      expect(foundDobon).toBe(true);
    });
  });

  // -------------------------------------------------------
  // 最初のカードがスキップの場合
  // -------------------------------------------------------
  describe("最初のカードがスキップの場合", () => {
    it("効果: オーナーがスキップされ次のプレイヤーの手番になる", async () => {
      const { room, owner } = await setupWithFirstCard(testCards.skip);

      expect(room.state.currentTurnPlayerId).not.toBe(owner.sessionId);
    });

    it("カットイン: 同色スキップでカットインできる", async () => {
      const { room } = await setupWithHands(
        testCards.skip, // 赤スキップ
        dummyHand(100),
        [
          testCards.skip2,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(201 + i)),
        ],
        dummyHand(300),
      );

      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          for (const card of player.myHand) {
            if (card.color === "red" && card.value === "skip") {
              expect(player.playableCards.has(card.id)).toBe(true);
            }
          }
        }
      }
    });

    it("ドボン: 手札合計が20点と一致すればドボン可能", async () => {
      // 場札: 赤スキップ (20点)
      // スキップでP1→P2に手番が移るため、P3（非手番）に20点の手札を配置
      // P3手札: 9+8+3+0+0+0+0 = 20点
      const { room } = await setupWithHands(
        testCards.skip,
        dummyHand(100),
        dummyHand(200),
        [
          { id: "y9", color: "yellow", value: "9", points: 9 },
          { id: "b8", color: "blue", value: "8", points: 8 },
          { id: "g3", color: "green", value: "3", points: 3 },
          zeroCard(1),
          zeroCard(2),
          zeroCard(3),
          zeroCard(4),
        ],
      );

      let foundDobon = false;
      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          let total = 0;
          for (const card of player.myHand) total += card.points;
          if (total === 20) {
            expect(player.canDobon).toBe(true);
            foundDobon = true;
          }
        }
      }
      expect(foundDobon).toBe(true);
    });
  });

  // -------------------------------------------------------
  // 最初のカードがリバースの場合
  // -------------------------------------------------------
  describe("最初のカードがリバースの場合", () => {
    it("効果: 順番が逆方向になる", async () => {
      const { room } = await setupWithFirstCard(testCards.reverse);

      expect(room.state.turnDirection).toBe(-1);
    });

    it("カットイン: 同色リバースでカットインできる", async () => {
      const { room } = await setupWithHands(
        testCards.reverse, // 赤リバース
        dummyHand(100),
        [
          testCards.reverse2,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(201 + i)),
        ],
        dummyHand(300),
      );

      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          for (const card of player.myHand) {
            if (card.color === "red" && card.value === "reverse") {
              expect(player.playableCards.has(card.id)).toBe(true);
            }
          }
        }
      }
    });

    it("ドボン: 手札合計が20点と一致すればドボン可能", async () => {
      // 場札: 赤リバース (20点), P2手札: 9+8+3+0+0+0+0 = 20点
      const { room } = await setupWithHands(
        testCards.reverse,
        dummyHand(100),
        [
          { id: "y9", color: "yellow", value: "9", points: 9 },
          { id: "b8", color: "blue", value: "8", points: 8 },
          { id: "g3-d", color: "green", value: "3", points: 3 },
          zeroCard(1),
          zeroCard(2),
          zeroCard(3),
          zeroCard(4),
        ],
        dummyHand(300),
      );

      let foundDobon = false;
      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          let total = 0;
          for (const card of player.myHand) total += card.points;
          if (total === 20) {
            expect(player.canDobon).toBe(true);
            foundDobon = true;
          }
        }
      }
      expect(foundDobon).toBe(true);
    });
  });

  // -------------------------------------------------------
  // 最初のカードがドロー2の場合
  // -------------------------------------------------------
  describe("最初のカードがドロー2の場合", () => {
    it("効果: canDrawStackがtrue、canDrawはfalse", async () => {
      const { room } = await setupWithFirstCard(testCards.draw2);

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.canDrawStack).toBe(true);
      expect(currentPlayer?.canDraw).toBe(false);
    });

    it("出せるカード: draw2を重ねられる", async () => {
      const { room } = await setupWithHands(
        testCards.draw2,
        [
          testCards.draw2_2,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.playableCards.has(testCards.draw2_2.id)).toBe(true);
    });

    it("出せるカード: draw4を重ねられる", async () => {
      const { room } = await setupWithHands(
        testCards.draw2,
        [
          testCards.draw4_2,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.playableCards.has(testCards.draw4_2.id)).toBe(true);
    });

    it("出せるカード: 通常カードは出せない", async () => {
      const { room } = await setupWithHands(
        testCards.draw2,
        [
          testCards.number3,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(101 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.playableCards.has(testCards.number3.id)).toBe(
        false,
      );
    });

    it("カットイン: 同色ドロー2でカットインできる", async () => {
      const { room } = await setupWithHands(
        testCards.draw2, // 緑ドロー2
        dummyHand(100),
        [
          testCards.draw2_2,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(201 + i)),
        ],
        dummyHand(300),
      );

      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          for (const card of player.myHand) {
            if (card.color === "green" && card.value === "draw2") {
              expect(player.playableCards.has(card.id)).toBe(true);
            }
          }
        }
      }
    });

    it("ドボン: 手札合計が20点と一致すればドボン可能", async () => {
      // 場札: 緑ドロー2 (20点), P2手札: 9+8+3+0+0+0+0 = 20点
      const { room } = await setupWithHands(
        testCards.draw2,
        dummyHand(100),
        [
          { id: "y9-d", color: "yellow", value: "9", points: 9 },
          { id: "b8-d", color: "blue", value: "8", points: 8 },
          { id: "g3-d2", color: "green", value: "3", points: 3 },
          zeroCard(1),
          zeroCard(2),
          zeroCard(3),
          zeroCard(4),
        ],
        dummyHand(300),
      );

      let foundDobon = false;
      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          let total = 0;
          for (const card of player.myHand) total += card.points;
          if (total === 20) {
            expect(player.canDobon).toBe(true);
            foundDobon = true;
          }
        }
      }
      expect(foundDobon).toBe(true);
    });
  });

  // -------------------------------------------------------
  // 最初のカードがワイルドの場合
  // -------------------------------------------------------
  describe("最初のカードがワイルドの場合", () => {
    it("効果: 色選択不要、canDrawがtrue、canChooseColorはfalse", async () => {
      const { room } = await setupWithFirstCard(testCards.wild);

      expect(room.state.waitingForColorChoice).toBe(false);

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.canDraw).toBe(true);
      expect(currentPlayer?.canChooseColor).toBe(false);
    });

    it("出せるカード: 全カード出せる", async () => {
      const { room } = await setupWithHands(
        testCards.wild,
        [
          testCards.red1,
          testCards.blue2,
          testCards.green3,
          testCards.yellow4,
          testCards.skip2,
          testCards.draw2_2,
          testCards.forceChangeBlue,
        ],
        dummyHand(200),
        dummyHand(300),
      );

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.playableCards.size).toBe(
        currentPlayer?.myHand.length,
      );
    });

    it("カットイン: ワイルド同士でカットインできる", async () => {
      const { room } = await setupWithHands(
        testCards.wild,
        dummyHand(100),
        [
          testCards.wild2,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(201 + i)),
        ],
        dummyHand(300),
      );

      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          for (const card of player.myHand) {
            if (card.value === "wild" && card.color === "wild") {
              expect(player.playableCards.has(card.id)).toBe(true);
            }
          }
        }
      }
    });

    it("ドボン: 手札合計が30点と一致すればドボン可能", async () => {
      // 場札: ワイルド (30点), P2手札: 9+8+7+6+0+0+0 = 30点
      const { room } = await setupWithHands(
        testCards.wild,
        dummyHand(100),
        [
          { id: "y9-w", color: "yellow", value: "9", points: 9 },
          { id: "b8-w", color: "blue", value: "8", points: 8 },
          { id: "g7-w", color: "green", value: "7", points: 7 },
          { id: "r6-w", color: "red", value: "6", points: 6 },
          zeroCard(1),
          zeroCard(2),
          zeroCard(3),
        ],
        dummyHand(300),
      );

      let foundDobon = false;
      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          let total = 0;
          for (const card of player.myHand) total += card.points;
          if (total === 30) {
            expect(player.canDobon).toBe(true);
            foundDobon = true;
          }
        }
      }
      expect(foundDobon).toBe(true);
    });
  });

  // -------------------------------------------------------
  // 最初のカードがドロー4の場合
  // -------------------------------------------------------
  describe("最初のカードがドロー4の場合", () => {
    it("効果: drawStackが4、色選択不要、canDrawStackがtrue", async () => {
      const { room } = await setupWithFirstCard(testCards.draw4);

      expect(room.state.drawStack).toBe(4);
      expect(room.state.waitingForColorChoice).toBe(false);

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.canDrawStack).toBe(true);
      expect(currentPlayer?.canChooseColor).toBe(false);
    });

    it("出せるカード: draw4のみ出せる（draw2は不可）", async () => {
      const { room } = await setupWithHands(
        testCards.draw4,
        [
          testCards.draw4_2,
          testCards.draw2_2,
          ...Array.from({ length: 5 }, (_, i) => createDummyCard(102 + i)),
        ],
        dummyHand(200),
        dummyHand(300),
      );

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.playableCards.has(testCards.draw4_2.id)).toBe(true);
      expect(currentPlayer?.playableCards.has(testCards.draw2_2.id)).toBe(
        false,
      );
    });

    it("出せるカード: draw4を持っていなければ出せるカードがない", async () => {
      const { room } = await setupWithFirstCard(testCards.draw4);

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.playableCards.size).toBe(0);
    });

    it("カットイン: ドロー4同士でカットインできる", async () => {
      const { room } = await setupWithHands(
        testCards.draw4,
        dummyHand(100),
        [
          testCards.draw4_3,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(201 + i)),
        ],
        dummyHand(300),
      );

      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          for (const card of player.myHand) {
            if (card.value === "draw4" && card.color === "wild") {
              expect(player.playableCards.has(card.id)).toBe(true);
            }
          }
        }
      }
    });

    it("ドボン: 手札合計が50点と一致すればドボン可能", async () => {
      // 場札: ドロー4 (50点), P2手札: 9+9+8+8+7+5+4 = 50点
      const { room } = await setupWithHands(
        testCards.draw4,
        dummyHand(100),
        [
          { id: "y9-d4", color: "yellow", value: "9", points: 9 },
          { id: "b9-d4", color: "blue", value: "9", points: 9 },
          { id: "g8-d4", color: "green", value: "8", points: 8 },
          { id: "r8-d4", color: "red", value: "8", points: 8 },
          { id: "y7-d4", color: "yellow", value: "7", points: 7 },
          { id: "b5-d4", color: "blue", value: "5", points: 5 },
          { id: "g4-d4", color: "green", value: "4", points: 4 },
        ],
        dummyHand(300),
      );

      let foundDobon = false;
      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          let total = 0;
          for (const card of player.myHand) total += card.points;
          if (total === 50) {
            expect(player.canDobon).toBe(true);
            foundDobon = true;
          }
        }
      }
      expect(foundDobon).toBe(true);
    });
  });

  // -------------------------------------------------------
  // 最初のカードが強制色変えの場合
  // -------------------------------------------------------
  describe("最初のカードが強制色変えの場合", () => {
    it("効果: currentColorがカードの色になる", async () => {
      const { room } = await setupWithFirstCard(testCards.forceChangeRed);

      expect(room.state.currentColor).toBe("red");
      expect(room.state.waitingForColorChoice).toBe(false);
    });

    it("出せるカード: 同色・ワイルド・ドロー4は出せるが、他色は不可", async () => {
      const { room } = await setupWithHands(
        testCards.forceChangeRed, // 場の色: 赤
        [
          testCards.red1,
          testCards.red6,
          testCards.blue2,
          testCards.green3,
          testCards.yellow4,
          testCards.wild2,
          testCards.draw4_2,
        ],
        dummyHand(200),
        dummyHand(300),
      );

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );

      // 赤カードは出せる
      expect(currentPlayer?.playableCards.has(testCards.red1.id)).toBe(true);
      expect(currentPlayer?.playableCards.has(testCards.red6.id)).toBe(true);
      // 他色は出せない
      expect(currentPlayer?.playableCards.has(testCards.blue2.id)).toBe(false);
      expect(currentPlayer?.playableCards.has(testCards.green3.id)).toBe(false);
      expect(currentPlayer?.playableCards.has(testCards.yellow4.id)).toBe(
        false,
      );
      // ワイルド・ドロー4は出せる
      expect(currentPlayer?.playableCards.has(testCards.wild2.id)).toBe(true);
      expect(currentPlayer?.playableCards.has(testCards.draw4_2.id)).toBe(true);
    });

    it("カットイン: 色違いの強制色変えでもカットインできる", async () => {
      const { room } = await setupWithHands(
        testCards.forceChangeRed, // 赤の強制色変え
        dummyHand(100),
        [
          testCards.forceChangeBlue,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(201 + i)),
        ],
        [
          testCards.forceChangeGreen,
          ...Array.from({ length: 6 }, (_, i) => createDummyCard(301 + i)),
        ],
      );

      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          for (const card of player.myHand) {
            if (card.value === "force-change") {
              expect(player.playableCards.has(card.id)).toBe(true);
            }
          }
        }
      }
    });

    it("ドボン: 手札合計が10点と一致すればドボン可能", async () => {
      // 場札: 赤強制色変え (10点), P2手札: 9+1+0+0+0+0+0 = 10点
      const { room } = await setupWithHands(
        testCards.forceChangeRed,
        dummyHand(100),
        [
          { id: "y9-fc", color: "yellow", value: "9", points: 9 },
          { id: "b1-fc", color: "blue", value: "1", points: 1 },
          zeroCard(1),
          zeroCard(2),
          zeroCard(3),
          zeroCard(4),
          zeroCard(5),
        ],
        dummyHand(300),
      );

      let foundDobon = false;
      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          let total = 0;
          for (const card of player.myHand) total += card.points;
          if (total === 10) {
            expect(player.canDobon).toBe(true);
            foundDobon = true;
          }
        }
      }
      expect(foundDobon).toBe(true);
    });
  });

  // -------------------------------------------------------
  // playingフェーズ前の操作制限
  // -------------------------------------------------------
  describe("playingフェーズ前の操作制限", () => {
    it("ゲーム開始直後にカードを出そうとしても無視される", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");
      await room.waitForNextPatch();

      expect(["dealing", "countdown"]).toContain(room.state.phase);

      owner.send("playCard", { cardIds: ["dummy-card-id"] });
      await room.waitForNextPatch();

      expect(room.state.fieldCards.length).toBe(0);
    });

    it("countdownフェーズ中にカードを出そうとしても無視される", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");

      const timeout = Date.now() + 15000;
      while (room.state.phase !== "countdown" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      expect(room.state.phase).toBe("countdown");

      owner.send("playCard", { cardIds: ["dummy-card-id"] });
      await room.waitForNextPatch();

      expect(room.state.fieldCards.length).toBe(0);
    });
  });

  // -------------------------------------------------------
  // ターンタイマー
  // -------------------------------------------------------
  describe("ターンタイマー", () => {
    it("playingフェーズ開始時に手番プレイヤーのtimeRemainingが設定される", async () => {
      const { room } = await setupWithFirstCard(testCards.number);

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );

      expect(currentPlayer?.timeRemaining).toBeGreaterThan(0);
      expect(currentPlayer?.timeRemaining).toBe(
        Math.ceil(TIMING.TURN_TIMEOUT / 1000),
      );
    });

    it("手番でないプレイヤーのtimeRemainingは0", async () => {
      const { room } = await setupWithFirstCard(testCards.number);

      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          expect(player.timeRemaining).toBe(0);
        }
      }
    });

    it("タイムアウト後に手番プレイヤーのtimeRemainingが0になる", async () => {
      // タイマーテスト用に短いタイムアウトを設定
      const shortTimeout = 100;
      const { room } = await setupWithHands(
        testCards.number,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
        { turnTimeout: shortTimeout },
      );

      const currentPlayerId = room.state.currentTurnPlayerId;

      await new Promise((resolve) => setTimeout(resolve, shortTimeout + 100));

      const timeout = Date.now() + 1000;
      while (
        room.state.players.get(currentPlayerId)?.timeRemaining !== 0 &&
        Date.now() < timeout
      ) {
        await room.waitForNextPatch();
      }

      expect(room.state.players.get(currentPlayerId)?.timeRemaining).toBe(0);
    });

    it("ドロー累積中にタイムアウトするとtimeRemainingが0になる", async () => {
      // タイマーテスト用に短いタイムアウトを設定
      const shortTimeout = 100;
      const { room } = await setupWithHands(
        testCards.draw4,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
        { turnTimeout: shortTimeout },
      );

      expect(room.state.drawStack).toBe(4);

      const currentPlayerId = room.state.currentTurnPlayerId;

      await new Promise((resolve) => setTimeout(resolve, shortTimeout + 100));

      const timeout = Date.now() + 1000;
      while (
        room.state.players.get(currentPlayerId)?.timeRemaining !== 0 &&
        Date.now() < timeout
      ) {
        await room.waitForNextPatch();
      }

      expect(room.state.players.get(currentPlayerId)?.timeRemaining).toBe(0);
    });
  });
});
