import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import appConfig from "../app.config";

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

// テスト用カードデータ
const testCards = {
  red5: { id: "r5", color: "red", value: "5", points: 5 },
  red3: { id: "r3", color: "red", value: "3", points: 3 },
};

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

describe("PassCommand", () => {
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

  // ヘルパー: playingフェーズまで進める
  async function setupGame() {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    const player2 = await colyseus.connectTo(room, { playerName: "Player2" });
    const player3 = await colyseus.connectTo(room, { playerName: "Player3" });

    const testDeck = createTestDeckWithPlayerHands(
      testCards.red5,
      dummyHand(100),
      dummyHand(200),
      dummyHand(300),
    );
    owner.send("__setDeck", testDeck);
    await new Promise((resolve) => setTimeout(resolve, 50));

    owner.send("startGame");

    const timeout = Date.now() + 15000;
    while (room.state.phase !== "playing" && Date.now() < timeout) {
      await room.waitForNextPatch();
    }

    // ヘルパー: hasDrawnThisTurn を設定
    const setHasDrawn = async (value: boolean): Promise<void> => {
      owner.send("__setHasDrawnThisTurn", value);
      await new Promise((resolve) => setTimeout(resolve, 50));
    };

    return { room, owner, player2, player3, setHasDrawn };
  }

  // -------------------------------------------------------
  // バリデーション
  // -------------------------------------------------------
  describe("バリデーション", () => {
    it("playing以外のフェーズではパスできない", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      expect(room.state.phase).toBe("waiting");

      owner.send("pass");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // フェーズは変わらない
      expect(room.state.phase).toBe("waiting");
    });

    it("hasDrawnThisTurn が false ではパスできない", async () => {
      const { room, owner } = await setupGame();

      expect(room.state.hasDrawnThisTurn).toBe(false);
      const currentTurnBefore = room.state.currentTurnPlayerId;

      owner.send("pass");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 手番は変わらない
      expect(room.state.currentTurnPlayerId).toBe(currentTurnBefore);
    });

    it("非手番プレイヤーはパスできない", async () => {
      const { room, owner, player2, setHasDrawn } = await setupGame();

      // ドロー済み状態に設定
      await setHasDrawn(true);

      expect(room.state.hasDrawnThisTurn).toBe(true);
      expect(room.state.currentTurnPlayerId).toBe(owner.sessionId);

      // Player2がパスしようとする（タイムアウトより先に確認）
      player2.send("pass");
      await new Promise((resolve) => setTimeout(resolve, 20));

      // 手番は変わらない（Ownerのまま）
      expect(room.state.currentTurnPlayerId).toBe(owner.sessionId);
    });

    it("ドロー後はcanPassがtrueになる", async () => {
      const { room, owner, setHasDrawn } = await setupGame();

      const ownerPlayer = room.state.players.get(owner.sessionId);
      expect(ownerPlayer?.canPass).toBe(false);

      // ドロー済み状態に設定
      await setHasDrawn(true);

      expect(ownerPlayer?.canPass).toBe(true);
    });
  });

  // -------------------------------------------------------
  // 実行
  // -------------------------------------------------------
  describe("実行", () => {
    it("パス後、hasDrawnThisTurnがfalseにリセットされる", async () => {
      const { room, owner, setHasDrawn } = await setupGame();

      // ドロー済み状態に設定
      await setHasDrawn(true);
      expect(room.state.hasDrawnThisTurn).toBe(true);

      // パスする
      owner.send("pass");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.hasDrawnThisTurn).toBe(false);
    });

    it("パス後、次のプレイヤーに手番が移る", async () => {
      const { room, owner, player2, setHasDrawn } = await setupGame();

      expect(room.state.currentTurnPlayerId).toBe(owner.sessionId);

      // ドロー済み状態に設定してパス
      await setHasDrawn(true);
      owner.send("pass");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.currentTurnPlayerId).toBe(player2.sessionId);
    });

    it("パス後、新しい手番プレイヤーのcanDrawがtrueになる", async () => {
      const { room, owner, player2, setHasDrawn } = await setupGame();

      // ドロー済み状態に設定してパス
      await setHasDrawn(true);
      owner.send("pass");
      await new Promise((resolve) => setTimeout(resolve, 100));

      const p2Player = room.state.players.get(player2.sessionId);
      expect(p2Player?.canDraw).toBe(true);
    });

    it("パス後、前のプレイヤーのcanDrawがfalseになる", async () => {
      const { room, owner, setHasDrawn } = await setupGame();

      // ドロー済み状態に設定してパス
      await setHasDrawn(true);
      owner.send("pass");
      await new Promise((resolve) => setTimeout(resolve, 100));

      const ownerPlayer = room.state.players.get(owner.sessionId);
      expect(ownerPlayer?.canDraw).toBe(false);
    });

    it("パス後、全プレイヤーのcanPassがfalseになる", async () => {
      const { room, owner, player2, player3, setHasDrawn } = await setupGame();

      // ドロー済み状態に設定してパス
      await setHasDrawn(true);
      owner.send("pass");
      await new Promise((resolve) => setTimeout(resolve, 100));

      const ownerPlayer = room.state.players.get(owner.sessionId);
      const p2Player = room.state.players.get(player2.sessionId);
      const p3Player = room.state.players.get(player3.sessionId);

      expect(ownerPlayer?.canPass).toBe(false);
      expect(p2Player?.canPass).toBe(false);
      expect(p3Player?.canPass).toBe(false);
    });
  });

  // -------------------------------------------------------
  // ドボン判定
  // -------------------------------------------------------
  describe("ドボン判定", () => {
    it("パス後、場のカードに対してドボン判定が更新される", async () => {
      const { room, owner, player2, setHasDrawn } = await setupGame();

      // Player2の手札を場のカード（赤5 = 5点）と同じ点数に設定
      player2.send("__setHand", [
        { id: "p2-3", color: "blue", value: "3", points: 3 },
        { id: "p2-2", color: "blue", value: "2", points: 2 },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // ドロー済み状態に設定してパス
      await setHasDrawn(true);
      owner.send("pass");
      await new Promise((resolve) => setTimeout(resolve, 50));

      const p2Player = room.state.players.get(player2.sessionId);
      expect(p2Player?.canDobon).toBe(true);
    });
  });
});
