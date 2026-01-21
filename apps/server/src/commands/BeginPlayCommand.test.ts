import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import appConfig from "../app.config";

// テスト用カードデータ
const testCards = {
  number: { id: "r5", color: "red", value: "5", points: 5 },
  number3: { id: "r3", color: "red", value: "3", points: 3 },
  number2: { id: "r2", color: "red", value: "2", points: 2 },
  wild: { id: "wild-1", color: "wild", value: "wild", points: 50 },
  wild2: { id: "wild-2", color: "wild", value: "wild", points: 50 },
  draw4: { id: "draw4-1", color: "wild", value: "draw4", points: 50 },
  draw4_2: { id: "draw4-2", color: "wild", value: "draw4", points: 50 },
  draw2: { id: "g-draw2", color: "green", value: "draw2", points: 20 },
  draw2_2: { id: "g-draw2-2", color: "green", value: "draw2", points: 20 },
  blue5: { id: "b5", color: "blue", value: "5", points: 5 },
  green5: { id: "g5", color: "green", value: "5", points: 5 },
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

type CardData = { id: string; color: string; value: string; points: number };

/**
 * テスト用デッキを生成する
 * firstCardを指定し、残りはダミーカードで埋める
 *
 * デッキ構造（popで取るので後ろから消費される）:
 * [残りカード... | firstCard | 手札用21枚]
 *
 * 配布順序（3人プレイヤーの場合）:
 * Round 1: pop() → P1-1, pop() → P2-1, pop() → P3-1
 * Round 2: pop() → P1-2, pop() → P2-2, pop() → P3-2
 * ...
 * Round 7: pop() → P1-7, pop() → P2-7, pop() → P3-7
 *
 * つまりデッキ末尾から: P1-1, P2-1, P3-1, P1-2, P2-2, P3-2, ...
 */
function createTestDeck(
  firstCard: CardData,
  playerCount = 3,
  handCards?: CardData[],
) {
  const deck: CardData[] = [];
  const handCardsNeeded = playerCount * 7; // 3人 × 7枚 = 21枚

  // 残りの山札（十分な枚数）
  for (let i = 0; i < 80; i++) {
    deck.push(createDummyCard(i));
  }

  // firstCard（手札配布後にpopされる）
  deck.push(firstCard);

  // 手札用カード
  if (handCards && handCards.length > 0) {
    // 指定された手札カードを使用（末尾からpopされるので逆順に追加）
    for (let i = handCardsNeeded - 1; i >= 0; i--) {
      if (i < handCards.length) {
        deck.push(handCards[i]);
      } else {
        deck.push(createDummyCard(100 + i));
      }
    }
  } else {
    // デフォルトのダミーカード
    for (let i = 0; i < handCardsNeeded; i++) {
      deck.push(createDummyCard(100 + i));
    }
  }

  return deck;
}

/**
 * プレイヤーごとの手札を指定してデッキを生成する
 * 配布順序を考慮して正しい位置にカードを配置
 */
function createTestDeckWithPlayerHands(
  firstCard: CardData,
  player1Hand: CardData[], // 7枚
  player2Hand: CardData[], // 7枚
  player3Hand: CardData[], // 7枚
) {
  const deck: CardData[] = [];

  // 残りの山札（十分な枚数）
  for (let i = 0; i < 80; i++) {
    deck.push(createDummyCard(i));
  }

  // firstCard（手札配布後にpopされる）
  deck.push(firstCard);

  // 配布順序を考慮して手札カードを追加
  // Round 1: P1[0], P2[0], P3[0]
  // Round 2: P1[1], P2[1], P3[1]
  // ...
  // Round 7: P1[6], P2[6], P3[6]
  // デッキは末尾からpopされるので、逆順に追加する
  for (let round = 6; round >= 0; round--) {
    // 各ラウンドでP3, P2, P1の順に追加（popで逆順になる）
    deck.push(player3Hand[round] || createDummyCard(300 + round));
    deck.push(player2Hand[round] || createDummyCard(200 + round));
    deck.push(player1Hand[round] || createDummyCard(100 + round));
  }

  return deck;
}

describe("BeginPlayCommand", () => {
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

  // ヘルパー関数: ゲームをplayingフェーズまで進める
  async function setupGameUntilPlaying() {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    const player2 = await colyseus.connectTo(room, { playerName: "Player2" });
    const player3 = await colyseus.connectTo(room, { playerName: "Player3" });

    owner.send("startGame");

    const timeout = Date.now() + 15000;
    while (room.state.phase !== "playing" && Date.now() < timeout) {
      await room.waitForNextPatch();
    }

    return { room, owner, player2, player3 };
  }

  // ヘルパー関数: 特定のカードを最初の場札に設定してplayingフェーズまで進める
  async function setupGameWithFirstCard(
    cardData: {
      id: string;
      color: string;
      value: string;
      points: number;
    },
    handCards?: { id: string; color: string; value: string; points: number }[],
  ) {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    const player2 = await colyseus.connectTo(room, { playerName: "Player2" });
    const player3 = await colyseus.connectTo(room, { playerName: "Player3" });

    // テスト用デッキを設定
    const testDeck = createTestDeck(cardData, 3, handCards);
    owner.send("__setDeck", testDeck);
    await new Promise((resolve) => setTimeout(resolve, 50));

    owner.send("startGame");

    const timeout = Date.now() + 15000;
    while (room.state.phase !== "playing" && Date.now() < timeout) {
      await room.waitForNextPatch();
    }

    return { room, owner, player2, player3 };
  }

  describe("フェーズ移行", () => {
    it("最終的にplayingフェーズになる", async () => {
      const { room } = await setupGameUntilPlaying();

      expect(room.state.phase).toBe("playing");
    });

    it("revealingフェーズからplayingフェーズへ移行する", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");

      // revealingフェーズを経由することを確認
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

  describe("手番プレイヤーのアクション設定", () => {
    it("手番プレイヤーのcanDrawがtrueになる（通常カードの場合）", async () => {
      const { room } = await setupGameWithFirstCard(testCards.number);

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.canDraw).toBe(true);
    });

    it("手番でないプレイヤーのcanDrawはfalse", async () => {
      const { room } = await setupGameUntilPlaying();

      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          expect(player.canDraw).toBe(false);
        }
      }
    });

    it("手番プレイヤーのcanPassはfalse（初期状態）", async () => {
      const { room } = await setupGameUntilPlaying();

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.canPass).toBe(false);
    });

    it("手番でないプレイヤーの基本アクションがfalse", async () => {
      const { room } = await setupGameUntilPlaying();

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
  });

  describe("ワイルドカード時の動作", () => {
    it("ワイルドカードの場合、waitingForColorChoiceはfalse", async () => {
      const { room } = await setupGameWithFirstCard(testCards.wild);

      // ワイルドカードが最初の場合は色選択不要
      expect(room.state.waitingForColorChoice).toBe(false);
    });

    it("ワイルドカードの場合、canDrawはtrue", async () => {
      const { room } = await setupGameWithFirstCard(testCards.wild);

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.canDraw).toBe(true);
    });

    it("ワイルドカードの場合、canChooseColorはfalse", async () => {
      const { room } = await setupGameWithFirstCard(testCards.wild);

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.canChooseColor).toBe(false);
    });

    it("ドロー4の場合、waitingForColorChoiceがtrue", async () => {
      const { room } = await setupGameWithFirstCard(testCards.draw4);

      expect(room.state.waitingForColorChoice).toBe(true);

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.canChooseColor).toBe(true);
    });
  });

  describe("ドロー累積時のアクション設定", () => {
    it("ドロー2の場合、canDrawStackがtrue", async () => {
      const { room } = await setupGameWithFirstCard(testCards.draw2);

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.canDrawStack).toBe(true);
    });

    it("ドロー2の場合、canDrawはfalse", async () => {
      const { room } = await setupGameWithFirstCard(testCards.draw2);

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.canDraw).toBe(false);
    });

    it("ドロー4の場合、canDrawStackがtrue", async () => {
      const { room } = await setupGameWithFirstCard(testCards.draw4);

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );
      expect(currentPlayer?.canDrawStack).toBe(true);
    });
  });

  describe("ドロー累積時の出せるカード判定", () => {
    it("ドロー2の場合、draw2が出せる", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      // プレイヤーごとの手札を指定
      const player1Hand = [
        testCards.draw2_2, // draw2を持っている
        createDummyCard(101),
        createDummyCard(102),
        createDummyCard(103),
        createDummyCard(104),
        createDummyCard(105),
        createDummyCard(106),
      ];
      const player2Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(200 + i),
      );
      const player3Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(300 + i),
      );

      const testDeck = createTestDeckWithPlayerHands(
        testCards.draw2,
        player1Hand,
        player2Hand,
        player3Hand,
      );
      owner.send("__setDeck", testDeck);
      await new Promise((resolve) => setTimeout(resolve, 50));

      owner.send("startGame");

      const timeout = Date.now() + 15000;
      while (room.state.phase !== "playing" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );

      // draw2が出せることを確認
      const hasDraw2InPlayable = currentPlayer?.playableCards.has(
        testCards.draw2_2.id,
      );
      expect(hasDraw2InPlayable).toBe(true);
    });

    it("ドロー2の場合、draw4が出せる", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      // プレイヤーごとの手札を指定
      const player1Hand = [
        testCards.draw4_2, // draw4を持っている
        createDummyCard(101),
        createDummyCard(102),
        createDummyCard(103),
        createDummyCard(104),
        createDummyCard(105),
        createDummyCard(106),
      ];
      const player2Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(200 + i),
      );
      const player3Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(300 + i),
      );

      const testDeck = createTestDeckWithPlayerHands(
        testCards.draw2,
        player1Hand,
        player2Hand,
        player3Hand,
      );
      owner.send("__setDeck", testDeck);
      await new Promise((resolve) => setTimeout(resolve, 50));

      owner.send("startGame");

      const timeout = Date.now() + 15000;
      while (room.state.phase !== "playing" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );

      // draw4が出せることを確認
      const hasDraw4InPlayable = currentPlayer?.playableCards.has(
        testCards.draw4_2.id,
      );
      expect(hasDraw4InPlayable).toBe(true);
    });

    it("ドロー2の場合、通常カードは出せない", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      // プレイヤーごとの手札を指定
      const player1Hand = [
        testCards.number3, // 数字カード
        createDummyCard(101),
        createDummyCard(102),
        createDummyCard(103),
        createDummyCard(104),
        createDummyCard(105),
        createDummyCard(106),
      ];
      const player2Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(200 + i),
      );
      const player3Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(300 + i),
      );

      const testDeck = createTestDeckWithPlayerHands(
        testCards.draw2,
        player1Hand,
        player2Hand,
        player3Hand,
      );
      owner.send("__setDeck", testDeck);
      await new Promise((resolve) => setTimeout(resolve, 50));

      owner.send("startGame");

      const timeout = Date.now() + 15000;
      while (room.state.phase !== "playing" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );

      // 数字カードは出せない
      const hasNumberInPlayable = currentPlayer?.playableCards.has(
        testCards.number3.id,
      );
      expect(hasNumberInPlayable).toBe(false);
    });

    it("ドロー4の場合、draw4のみ出せる", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      // プレイヤーごとの手札を指定
      const player1Hand = [
        testCards.draw4_2, // draw4を持っている
        testCards.draw2_2, // draw2も持っている（出せないはず）
        createDummyCard(102),
        createDummyCard(103),
        createDummyCard(104),
        createDummyCard(105),
        createDummyCard(106),
      ];
      const player2Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(200 + i),
      );
      const player3Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(300 + i),
      );

      const testDeck = createTestDeckWithPlayerHands(
        testCards.draw4,
        player1Hand,
        player2Hand,
        player3Hand,
      );
      owner.send("__setDeck", testDeck);
      await new Promise((resolve) => setTimeout(resolve, 50));

      owner.send("startGame");

      const timeout = Date.now() + 15000;
      while (room.state.phase !== "playing" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );

      // draw4は出せる
      const hasDraw4InPlayable = currentPlayer?.playableCards.has(
        testCards.draw4_2.id,
      );
      expect(hasDraw4InPlayable).toBe(true);

      // draw2は出せない
      const hasDraw2InPlayable = currentPlayer?.playableCards.has(
        testCards.draw2_2.id,
      );
      expect(hasDraw2InPlayable).toBe(false);
    });
  });

  describe("カットイン判定", () => {
    it("手番でないプレイヤーも同じカードならplayableCardsに含まれる", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      // Player2の手札に場札と同じr5を含める
      const player1Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(100 + i),
      );
      const player2Hand = [
        testCards.number, // red 5（場札と同じ）
        createDummyCard(201),
        createDummyCard(202),
        createDummyCard(203),
        createDummyCard(204),
        createDummyCard(205),
        createDummyCard(206),
      ];
      const player3Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(300 + i),
      );

      const testDeck = createTestDeckWithPlayerHands(
        testCards.number,
        player1Hand,
        player2Hand,
        player3Hand,
      );
      owner.send("__setDeck", testDeck);
      await new Promise((resolve) => setTimeout(resolve, 50));

      owner.send("startGame");

      const timeout = Date.now() + 15000;
      while (room.state.phase !== "playing" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      // 手番でないプレイヤーでカットインできるプレイヤーを探す
      let foundCutInPlayer = false;
      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          for (const card of player.myHand) {
            if (
              card.color === testCards.number.color &&
              card.value === testCards.number.value
            ) {
              expect(player.playableCards.size).toBeGreaterThan(0);
              foundCutInPlayer = true;
              break;
            }
          }
        }
        if (foundCutInPlayer) break;
      }

      expect(foundCutInPlayer).toBe(true);
    });

    it("手番でないプレイヤーで同じカードを持っていない場合はplayableCardsが空", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      // 全員異なるカードを持つ
      const player1Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(100 + i),
      );
      const player2Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(200 + i),
      );
      const player3Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(300 + i),
      );

      const testDeck = createTestDeckWithPlayerHands(
        testCards.number,
        player1Hand,
        player2Hand,
        player3Hand,
      );
      owner.send("__setDeck", testDeck);
      await new Promise((resolve) => setTimeout(resolve, 50));

      owner.send("startGame");

      const timeout = Date.now() + 15000;
      while (room.state.phase !== "playing" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      // 手番でないプレイヤーで同じカードを持っていない場合
      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          let hasSameCard = false;
          for (const card of player.myHand) {
            if (
              card.color === testCards.number.color &&
              card.value === testCards.number.value
            ) {
              hasSameCard = true;
              break;
            }
          }
          if (!hasSameCard) {
            expect(player.playableCards.size).toBe(0);
          }
        }
      }
    });

    it("ワイルド同士でカットインできる", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      // Player2の手札にワイルドを含める
      const player1Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(100 + i),
      );
      const player2Hand = [
        testCards.wild2, // 場札と同じワイルド
        createDummyCard(201),
        createDummyCard(202),
        createDummyCard(203),
        createDummyCard(204),
        createDummyCard(205),
        createDummyCard(206),
      ];
      const player3Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(300 + i),
      );

      const testDeck = createTestDeckWithPlayerHands(
        testCards.wild,
        player1Hand,
        player2Hand,
        player3Hand,
      );
      owner.send("__setDeck", testDeck);
      await new Promise((resolve) => setTimeout(resolve, 50));

      owner.send("startGame");

      const timeout = Date.now() + 15000;
      while (room.state.phase !== "playing" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      // 手番でないプレイヤーでワイルドを持っている人を探す
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
  });

  describe("ドボン判定", () => {
    it("場のカードの点数と手札の合計点数が一致すればcanDobonがtrue", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      // 場札は5点、Player1の手札の合計も5点（3 + 2 = 5点）
      const player1Hand = [
        testCards.number3, // 3点
        testCards.number2, // 2点
        { id: "y0", color: "yellow", value: "0", points: 0 },
        { id: "y0-2", color: "yellow", value: "0", points: 0 },
        { id: "y0-3", color: "yellow", value: "0", points: 0 },
        { id: "y0-4", color: "yellow", value: "0", points: 0 },
        { id: "y0-5", color: "yellow", value: "0", points: 0 },
      ];
      const player2Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(200 + i),
      );
      const player3Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(300 + i),
      );

      const testDeck = createTestDeckWithPlayerHands(
        testCards.number,
        player1Hand,
        player2Hand,
        player3Hand,
      );
      owner.send("__setDeck", testDeck);
      await new Promise((resolve) => setTimeout(resolve, 50));

      owner.send("startGame");

      const timeout = Date.now() + 15000;
      while (room.state.phase !== "playing" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );

      // 手札の合計が場のカードの点数（5点）と一致するのでドボン可能
      expect(currentPlayer?.canDobon).toBe(true);
    });

    it("場のカードの点数と手札の合計点数が一致しなければcanDobonがfalse", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      // 場札は5点、Player1の手札の合計は6点（3 + 3 = 6点）
      const player1Hand = [
        testCards.number3, // 3点
        { id: "r3-2", color: "red", value: "3", points: 3 }, // 3点
        { id: "y0", color: "yellow", value: "0", points: 0 },
        { id: "y0-2", color: "yellow", value: "0", points: 0 },
        { id: "y0-3", color: "yellow", value: "0", points: 0 },
        { id: "y0-4", color: "yellow", value: "0", points: 0 },
        { id: "y0-5", color: "yellow", value: "0", points: 0 },
      ];
      const player2Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(200 + i),
      );
      const player3Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(300 + i),
      );

      const testDeck = createTestDeckWithPlayerHands(
        testCards.number,
        player1Hand,
        player2Hand,
        player3Hand,
      );
      owner.send("__setDeck", testDeck);
      await new Promise((resolve) => setTimeout(resolve, 50));

      owner.send("startGame");

      const timeout = Date.now() + 15000;
      while (room.state.phase !== "playing" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );

      // 手札の合計（6点）が場のカードの点数（5点）と一致しないのでドボン不可
      expect(currentPlayer?.canDobon).toBe(false);
    });

    it("手番でないプレイヤーもドボン可能", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      // 場札は5点、Player2の手札の合計が5点
      const player1Hand = [
        { id: "y9", color: "yellow", value: "9", points: 9 }, // 9点
        createDummyCard(101),
        createDummyCard(102),
        createDummyCard(103),
        createDummyCard(104),
        createDummyCard(105),
        createDummyCard(106),
      ];
      const player2Hand = [
        testCards.number3, // 3点
        testCards.number2, // 2点
        { id: "y0", color: "yellow", value: "0", points: 0 },
        { id: "y0-2", color: "yellow", value: "0", points: 0 },
        { id: "y0-3", color: "yellow", value: "0", points: 0 },
        { id: "y0-4", color: "yellow", value: "0", points: 0 },
        { id: "y0-5", color: "yellow", value: "0", points: 0 },
      ];
      const player3Hand = Array.from({ length: 7 }, (_, i) =>
        createDummyCard(300 + i),
      );

      const testDeck = createTestDeckWithPlayerHands(
        testCards.number,
        player1Hand,
        player2Hand,
        player3Hand,
      );
      owner.send("__setDeck", testDeck);
      await new Promise((resolve) => setTimeout(resolve, 50));

      owner.send("startGame");

      const timeout = Date.now() + 15000;
      while (room.state.phase !== "playing" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      // 手番でないプレイヤーでドボンできるプレイヤーを探す
      let foundDobonPlayer = false;
      for (const [sessionId, player] of room.state.players.entries()) {
        if (sessionId !== room.state.currentTurnPlayerId) {
          let handTotal = 0;
          for (const card of player.myHand) {
            handTotal += card.points;
          }
          if (handTotal === testCards.number.points) {
            expect(player.canDobon).toBe(true);
            foundDobonPlayer = true;
          }
        }
      }

      expect(foundDobonPlayer).toBe(true);
    });
  });

  describe("出せるカードの計算", () => {
    it("手番プレイヤーに出せるカードが設定される", async () => {
      const { room } = await setupGameWithFirstCard(testCards.number);

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );

      // 色選択待ちでなければplayableCardsが設定される可能性がある
      // （手札の内容によるが、少なくともエラーにならないことを確認）
      expect(currentPlayer?.playableCards).toBeDefined();
    });

    it("ドロー4で色選択待ちの場合、playableCardsは空", async () => {
      const { room } = await setupGameWithFirstCard(testCards.draw4);

      const currentPlayer = room.state.players.get(
        room.state.currentTurnPlayerId,
      );

      expect(currentPlayer?.playableCards.size).toBe(0);
    });
  });

  describe("playingフェーズ前の操作制限", () => {
    it("ゲーム開始直後にカードを出そうとしても無視される", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");
      await room.waitForNextPatch();

      // ゲーム開始直後（dealingまたはcountdown）
      expect(["dealing", "countdown"]).toContain(room.state.phase);

      // カードを出そうとする
      owner.send("playCard", { cardIds: ["dummy-card-id"] });
      await room.waitForNextPatch();

      // フェーズが変わっていないか、fieldCardsが空のまま
      expect(room.state.fieldCards.length).toBe(0);
    });

    it("countdownフェーズ中にカードを出そうとしても無視される", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      owner.send("startGame");

      // countdownフェーズまで待つ
      const timeout = Date.now() + 15000;
      while (room.state.phase !== "countdown" && Date.now() < timeout) {
        await room.waitForNextPatch();
      }

      expect(room.state.phase).toBe("countdown");

      // カードを出そうとする
      owner.send("playCard", { cardIds: ["dummy-card-id"] });
      await room.waitForNextPatch();

      // fieldCardsが0枚のまま（まだ場札は公開されていない）
      expect(room.state.fieldCards.length).toBe(0);
    });
  });
});
