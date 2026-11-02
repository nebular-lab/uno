import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bootTestServer } from "../test/setup";

type CardData = { id: string; color: string; value: string; points: number };

// テスト用カードデータ
const testCards = {
  red5: { id: "r5", color: "red", value: "5", points: 5 },
  red3: { id: "r3", color: "red", value: "3", points: 3 },
  red2: { id: "r2", color: "red", value: "2", points: 2 },
  red1: { id: "r1", color: "red", value: "1", points: 1 },
  blue7: { id: "b7", color: "blue", value: "7", points: 7 },
  blue1: { id: "b1", color: "blue", value: "1", points: 1 },
  green2: { id: "g2", color: "green", value: "2", points: 2 },
  green1: { id: "g1", color: "green", value: "1", points: 1 },
  yellow8: { id: "y8", color: "yellow", value: "8", points: 8 },
  yellow1: { id: "y1", color: "yellow", value: "1", points: 1 },
};

// ダミーカードを生成
function createDummyCard(index: number): CardData {
  const colors = ["red", "blue", "green", "yellow"];
  const color = colors[index % 4];
  const value = String(index % 10);
  return {
    id: `${color[0]}${value}-dummy-${index}`,
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

  // 山札の残り
  for (let i = 0; i < 80; i++) {
    deck.push(createDummyCard(i));
  }

  // 場札
  deck.push(firstCard);

  // デッキは末尾からpopされるので、逆順に追加する
  // 配布順: Player1 → Player2 → Player3 を7回繰り返す
  for (let round = 6; round >= 0; round--) {
    deck.push(player3Hand[round] || createDummyCard(300 + round));
    deck.push(player2Hand[round] || createDummyCard(200 + round));
    deck.push(player1Hand[round] || createDummyCard(100 + round));
  }

  return deck;
}

describe("ドボン待ち（SkipDobonCommand）", () => {
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

  /**
   * ゲームをplayingフェーズまで進め、setHand関数を返す
   */
  async function setupGame(firstCard: CardData) {
    const room = await colyseus.createRoom("game", {});

    const client1 = await colyseus.connectTo(room, { playerName: "Player1" });
    const client2 = await colyseus.connectTo(room, { playerName: "Player2" });
    const client3 = await colyseus.connectTo(room, { playerName: "Player3" });

    // テスト用デッキを設定
    const testDeck = createTestDeckWithPlayerHands(
      firstCard,
      dummyHand(100),
      dummyHand(200),
      dummyHand(300),
    );
    client1.send("__setDeck", testDeck);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // ゲーム開始
    client1.send("startGame");

    // playingフェーズまで待機
    const timeout = Date.now() + 15000;
    while (room.state.phase !== "playing" && Date.now() < timeout) {
      await room.waitForNextPatch();
    }

    // 手札を設定するヘルパー
    const setHand = async (
      client: typeof client1,
      cards: CardData[],
    ): Promise<void> => {
      client.send("__setHand", cards);
      await new Promise((resolve) => setTimeout(resolve, 50));
    };

    return { room, client1, client2, client3, setHand };
  }

  const wait = (ms = 100) => new Promise((r) => setTimeout(r, ms));

  // Player1: 5を出すと残り6点（ドボン返し不可）
  const player1Hand = [
    testCards.red5,
    testCards.red1,
    testCards.red1,
    testCards.red1,
    testCards.red1,
    testCards.red1,
    testCards.red1,
  ];
  // 合計5点（Player1の5にドボン可能）
  const fivePointsHand = [testCards.red2, testCards.red3];
  const anotherFivePointsHand = [
    testCards.green2,
    testCards.yellow1,
    testCards.blue1,
    testCards.red1,
  ];

  describe("ゲーム進行の停止", () => {
    it("ドボンできる人がいると、判断が出るまで次の操作ができない", async () => {
      const { room, client1, client2, client3, setHand } = await setupGame(
        testCards.red5,
      );
      await setHand(client1, player1Hand);
      await setHand(client2, fivePointsHand);
      await setHand(client3, [testCards.blue7, testCards.yellow8]);

      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await wait();

      expect(room.state.waitingForDobon).toBe(true);
      expect(room.state.currentTurnPlayerId).toBe(client2.sessionId);
      const player2 = room.state.players.get(client2.sessionId);
      expect(player2?.canDobon).toBe(true);
      expect(player2?.canDraw).toBe(false);
      expect(player2?.playableCards.size).toBe(0);

      // 手番のプレイヤーも山札を引けない
      client2.send("drawCard");
      await wait();
      expect(player2?.handCount).toBe(2);
      expect(room.state.waitingForDobon).toBe(true);
    });

    it("ドボンできる人がいなければ止まらない", async () => {
      const { room, client1, client2, client3, setHand } = await setupGame(
        testCards.red5,
      );
      await setHand(client1, player1Hand);
      await setHand(client2, [testCards.blue7]);
      await setHand(client3, [testCards.yellow8]);

      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await wait();

      expect(room.state.waitingForDobon).toBe(false);
      expect(room.state.players.get(client2.sessionId)?.canDraw).toBe(true);
    });
  });

  describe("ドボンしない", () => {
    it("ドボンしないを選ぶとゲームが再開する", async () => {
      const { room, client1, client2, client3, setHand } = await setupGame(
        testCards.red5,
      );
      await setHand(client1, player1Hand);
      await setHand(client2, fivePointsHand);
      await setHand(client3, [testCards.blue7, testCards.yellow8]);

      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await wait();

      client2.send("skipDobon");
      await wait();

      expect(room.state.waitingForDobon).toBe(false);
      expect(room.state.phase).toBe("playing");
      const player2 = room.state.players.get(client2.sessionId);
      expect(player2?.canDobon).toBe(false);
      expect(player2?.canDraw).toBe(true);
      expect(player2?.timeRemaining).toBeGreaterThan(0);
    });

    it("見送ったカードにはあとからドボンできない", async () => {
      const { room, client1, client2, client3, setHand } = await setupGame(
        testCards.red5,
      );
      await setHand(client1, player1Hand);
      await setHand(client2, fivePointsHand);
      await setHand(client3, [testCards.blue7, testCards.yellow8]);

      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await wait();
      client2.send("skipDobon");
      await wait();

      client2.send("dobon");
      await wait();

      expect(room.state.phase).toBe("playing");
      expect(room.state.dobonPlayerIds.length).toBe(0);
    });

    it("時間切れはドボンしない扱いになる", async () => {
      const { room, client1, client2, client3, setHand } = await setupGame(
        testCards.red5,
      );
      await setHand(client1, player1Hand);
      await setHand(client2, fivePointsHand);
      await setHand(client3, [testCards.blue7, testCards.yellow8]);
      client1.send("__setTurnTimeout", 300);
      await wait(50);

      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await wait();
      expect(room.state.waitingForDobon).toBe(true);

      await wait(350);

      expect(room.state.waitingForDobon).toBe(false);
      expect(room.state.players.get(client2.sessionId)?.canDobon).toBe(false);
      expect(room.state.phase).toBe("playing");
    });

    it("上がりカードに誰もドボンしなければ上がりが確定する", async () => {
      const { room, client1, client2, client3, setHand } = await setupGame(
        testCards.red5,
      );
      await setHand(client1, [testCards.red5]);
      await setHand(client2, fivePointsHand);
      await setHand(client3, [testCards.blue7, testCards.yellow8]);

      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await wait();
      expect(room.state.phase).toBe("playing");
      expect(room.state.waitingForDobon).toBe(true);

      client2.send("skipDobon");
      await wait();

      expect(room.state.phase).toBe("result");
      const result = room.state.gameHistory[room.state.gameHistory.length - 1];
      expect(result.finishType).toBe("normal");
      expect(result.winnerId).toBe(client1.sessionId);
    });
  });

  describe("複数人がドボンできる場合", () => {
    it("1人がドボンしても、もう1人が判断するまで確定しない", async () => {
      const { room, client1, client2, client3, setHand } = await setupGame(
        testCards.red5,
      );
      await setHand(client1, player1Hand);
      await setHand(client2, fivePointsHand);
      await setHand(client3, anotherFivePointsHand);

      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await wait();

      client2.send("dobon");
      await wait();

      expect(room.state.phase).toBe("playing");
      expect(room.state.waitingForDobon).toBe(true);
      expect(room.state.players.get(client3.sessionId)?.canDobon).toBe(true);

      client3.send("skipDobon");
      await wait();

      expect(room.state.phase).toBe("result");
      expect(Array.from(room.state.dobonPlayerIds)).toEqual([
        client2.sessionId,
      ]);
    });

    it("2人ともドボンすると両方がドボンした人になる", async () => {
      const { room, client1, client2, client3, setHand } = await setupGame(
        testCards.red5,
      );
      await setHand(client1, player1Hand);
      await setHand(client2, fivePointsHand);
      await setHand(client3, anotherFivePointsHand);

      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await wait();

      client3.send("dobon");
      await wait();
      client2.send("dobon");
      await wait();

      expect(room.state.phase).toBe("result");
      expect(Array.from(room.state.dobonPlayerIds)).toEqual([
        client3.sessionId,
        client2.sessionId,
      ]);
    });

    it("2人ともドボンしなければゲームが再開する", async () => {
      const { room, client1, client2, client3, setHand } = await setupGame(
        testCards.red5,
      );
      await setHand(client1, player1Hand);
      await setHand(client2, fivePointsHand);
      await setHand(client3, anotherFivePointsHand);

      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await wait();

      client2.send("skipDobon");
      await wait();
      expect(room.state.waitingForDobon).toBe(true);

      client3.send("skipDobon");
      await wait();

      expect(room.state.waitingForDobon).toBe(false);
      expect(room.state.phase).toBe("playing");
      expect(room.state.players.get(client2.sessionId)?.canDraw).toBe(true);
    });
  });
});
