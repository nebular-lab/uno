import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bootTestServer } from "../test/setup";

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
  wild: { id: "wild-1", color: "wild", value: "wild", points: 30 },
  draw4: { id: "draw4-1", color: "wild", value: "draw4", points: 50 },
  red5: { id: "r5", color: "red", value: "5", points: 5 },
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

describe("ChooseColorCommand", () => {
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

  // ヘルパー: playingフェーズまで進めてワイルドカードを出す
  async function setupGameWithWild() {
    const room = await colyseus.createRoom("game", {});
    const owner = await colyseus.connectTo(room, { playerName: "Owner" });
    const player2 = await colyseus.connectTo(room, { playerName: "Player2" });
    const player3 = await colyseus.connectTo(room, { playerName: "Player3" });

    // player1にワイルドカードを持たせる
    const player1Hand = [
      testCards.wild,
      ...dummyHand(100).slice(0, 6),
    ] as CardData[];

    const testDeck = createTestDeckWithPlayerHands(
      testCards.red5,
      player1Hand,
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

    return { room, owner, player2, player3 };
  }

  // ヘルパー: ワイルドカードを出して色選択待ち状態にする
  async function playWildCard(
    room: Awaited<ReturnType<typeof setupGameWithWild>>["room"],
    owner: Awaited<ReturnType<typeof setupGameWithWild>>["owner"],
  ) {
    // ワイルドカードを出す
    owner.send("playCard", { cardIds: [testCards.wild.id] });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(room.state.waitingForColorChoice).toBe(true);
  }

  // -------------------------------------------------------
  // バリデーション
  // -------------------------------------------------------
  describe("バリデーション", () => {
    it("canChooseColorがfalseの場合は色選択できない", async () => {
      const { room, owner } = await setupGameWithWild();

      // ワイルドカードを出す前はcanChooseColor=false
      const ownerPlayer = room.state.players.get(owner.sessionId);
      expect(ownerPlayer?.canChooseColor).toBe(false);

      // 場のカードがred5なので現在の色はred
      expect(room.state.currentColor).toBe("red");

      // 色選択しようとしても無視される（blueに変更を試みる）
      owner.send("chooseColor", "blue");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 状態は変わらない（redのまま）
      expect(room.state.currentColor).toBe("red");
    });

    it("無効な色は拒否される", async () => {
      const { room, owner } = await setupGameWithWild();
      await playWildCard(room, owner);

      const colorBefore = room.state.currentColor;

      // 無効な色を選択
      owner.send("chooseColor", "purple");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 状態は変わらない（色選択待ちのまま）
      expect(room.state.waitingForColorChoice).toBe(true);
      expect(room.state.currentColor).toBe(colorBefore);
    });

    it("非手番プレイヤーは色選択できない", async () => {
      const { room, owner, player2 } = await setupGameWithWild();
      await playWildCard(room, owner);

      // Player2が色選択しようとする
      player2.send("chooseColor", "blue");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 状態は変わらない（色選択待ちのまま）
      expect(room.state.waitingForColorChoice).toBe(true);
    });
  });

  // -------------------------------------------------------
  // 実行
  // -------------------------------------------------------
  describe("実行", () => {
    it("色選択後、currentColorが更新される", async () => {
      const { room, owner } = await setupGameWithWild();
      await playWildCard(room, owner);

      owner.send("chooseColor", "blue");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.currentColor).toBe("blue");
    });

    it("色選択後、waitingForColorChoiceがfalseになる", async () => {
      const { room, owner } = await setupGameWithWild();
      await playWildCard(room, owner);

      owner.send("chooseColor", "green");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.waitingForColorChoice).toBe(false);
    });

    it("色選択後、次のプレイヤーに手番が移る", async () => {
      const { room, owner, player2 } = await setupGameWithWild();
      await playWildCard(room, owner);

      // 色選択待ち中は手番がOwnerのまま
      expect(room.state.currentTurnPlayerId).toBe(owner.sessionId);

      owner.send("chooseColor", "yellow");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 次のプレイヤーに手番が移る
      expect(room.state.currentTurnPlayerId).toBe(player2.sessionId);
    });

    it("色選択後、canChooseColorがfalseになる", async () => {
      const { room, owner } = await setupGameWithWild();
      await playWildCard(room, owner);

      const ownerPlayer = room.state.players.get(owner.sessionId);
      expect(ownerPlayer?.canChooseColor).toBe(true);

      owner.send("chooseColor", "red");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(ownerPlayer?.canChooseColor).toBe(false);
    });

    it("色選択後、次のプレイヤーのplayableCardsが更新される", async () => {
      const { room, owner, player2 } = await setupGameWithWild();

      // Player2に赤カードを持たせる
      player2.send("__setHand", [
        { id: "p2-r5", color: "red", value: "5", points: 5 },
        { id: "p2-b3", color: "blue", value: "3", points: 3 },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 50));

      await playWildCard(room, owner);

      // 赤を選択
      owner.send("chooseColor", "red");
      await new Promise((resolve) => setTimeout(resolve, 100));

      const p2Player = room.state.players.get(player2.sessionId);
      // 赤5は出せる
      expect(p2Player?.playableCards.get("p2-r5")).toBe(true);
      // 青3は出せない
      expect(p2Player?.playableCards.get("p2-b3")).toBeFalsy();
    });

    it("全ての有効な色で選択できる", async () => {
      const colors = ["red", "blue", "green", "yellow"] as const;

      for (const color of colors) {
        await colyseus.cleanup();
        const { room, owner } = await setupGameWithWild();
        await playWildCard(room, owner);

        owner.send("chooseColor", color);
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(room.state.currentColor).toBe(color);
        expect(room.state.waitingForColorChoice).toBe(false);
      }
    });
  });

  // -------------------------------------------------------
  // Draw4 + 色選択
  // -------------------------------------------------------
  describe("Draw4 + 色選択", () => {
    it("Draw4を出した後も色選択できる", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      const player2 = await colyseus.connectTo(room, { playerName: "Player2" });
      await colyseus.connectTo(room, { playerName: "Player3" });

      // player1にDraw4を持たせる
      const player1Hand = [
        testCards.draw4,
        ...dummyHand(100).slice(0, 6),
      ] as CardData[];

      const testDeck = createTestDeckWithPlayerHands(
        testCards.red5,
        player1Hand,
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

      // Draw4を出す
      owner.send("playCard", { cardIds: [testCards.draw4.id] });
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.waitingForColorChoice).toBe(true);
      expect(room.state.drawStack).toBe(4);

      // 色を選択
      owner.send("chooseColor", "blue");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(room.state.currentColor).toBe("blue");
      expect(room.state.waitingForColorChoice).toBe(false);
      // drawStackは維持される
      expect(room.state.drawStack).toBe(4);
      // 次のプレイヤーに手番が移る
      expect(room.state.currentTurnPlayerId).toBe(player2.sessionId);
    });
  });
});
