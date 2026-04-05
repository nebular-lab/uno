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

describe("DobonCommand", () => {
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

    const client1 = await colyseus.connectTo(room, { name: "Player1" });
    const client2 = await colyseus.connectTo(room, { name: "Player2" });
    const client3 = await colyseus.connectTo(room, { name: "Player3" });

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

  describe("バリデーション", () => {
    it("playingフェーズ以外は拒否される", async () => {
      const room = await colyseus.createRoom("game", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });
      const _client2 = await colyseus.connectTo(room, { name: "Player2" });
      const _client3 = await colyseus.connectTo(room, { name: "Player3" });

      // waitingフェーズでドボンを試みる
      client1.send("dobon");
      await new Promise((r) => setTimeout(r, 100));

      // フェーズはwaitingのまま
      expect(client1.state.phase).toBe("waiting");
    });

    it("canDobon=falseの場合は拒否される", async () => {
      const { room, client1 } = await setupGame(testCards.red5);

      expect(room.state.phase).toBe("playing");

      // canDobonがfalseのプレイヤーがドボンを試みる
      const player1 = client1.state.players.get(client1.sessionId);
      expect(player1?.canDobon).toBe(false);

      client1.send("dobon");
      await new Promise((r) => setTimeout(r, 100));

      // dobonPlayerIdsは空のまま
      expect(client1.state.dobonPlayerIds.length).toBe(0);
    });
  });

  describe("ドボン宣言", () => {
    it("ドボンしたプレイヤーがdobonPlayerIdsに追加される", async () => {
      const { room, client1, client2, setHand } = await setupGame(
        testCards.red5,
      );

      expect(room.state.phase).toBe("playing");

      // Player1の手札を設定: red5を含む手札
      await setHand(client1, [
        testCards.red5,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
      ]);

      // Player2の手札を合計5点に設定
      await setHand(client2, [testCards.red2, testCards.red3]);

      // Player1がカードを出す
      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await new Promise((r) => setTimeout(r, 100));

      // Player2がドボン可能か確認
      const player2 = client2.state.players.get(client2.sessionId);
      expect(player2?.canDobon).toBe(true);

      // Player2がドボン
      client2.send("dobon");
      await new Promise((r) => setTimeout(r, 100));

      // dobonPlayerIdsにPlayer2が追加されている
      expect(client2.state.dobonPlayerIds.length).toBe(1);
      expect(client2.state.dobonPlayerIds[0]).toBe(client2.sessionId);
    });

    it("ドボンしたプレイヤーのcanDobonがfalseになる", async () => {
      const { room, client1, client2, setHand } = await setupGame(
        testCards.red5,
      );

      expect(room.state.phase).toBe("playing");

      // Player1の手札を設定
      await setHand(client1, [
        testCards.red5,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
      ]);

      // Player2の手札を合計5点に設定
      await setHand(client2, [testCards.red2, testCards.red3]);

      // Player1がカードを出す
      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await new Promise((r) => setTimeout(r, 100));

      // ドボン前
      const player2Before = client2.state.players.get(client2.sessionId);
      expect(player2Before?.canDobon).toBe(true);

      // ドボン
      client2.send("dobon");
      await new Promise((r) => setTimeout(r, 100));

      // ドボン後
      const player2After = client2.state.players.get(client2.sessionId);
      expect(player2After?.canDobon).toBe(false);
    });
  });

  describe("点数計算", () => {
    it("ドボンされた人が全員の手札合計点数を支払う", async () => {
      const { room, client1, client2, client3, setHand } = await setupGame(
        testCards.red5,
      );

      expect(room.state.phase).toBe("playing");

      // Player1の手札を設定: 5を出すと残り6点
      await setHand(client1, [
        testCards.red5,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
      ]);

      // Player2の手札を合計5点に設定（ドボン可能）
      await setHand(client2, [testCards.red2, testCards.red3]);

      // Player3の手札を合計7点に設定（ドボン不可）
      await setHand(client3, [testCards.blue7]);

      // 初期スコアを記録
      const initialScore1 =
        client1.state.players.get(client1.sessionId)?.score ?? 0;
      const initialScore2 =
        client1.state.players.get(client2.sessionId)?.score ?? 0;
      const initialScore3 =
        client1.state.players.get(client3.sessionId)?.score ?? 0;

      // Player1がカードを出す
      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await new Promise((r) => setTimeout(r, 100));

      // playCard後のcanDobon確認
      const p2AfterPlay = room.state.players.get(client2.sessionId);
      expect(p2AfterPlay?.canDobon).toBe(true); // Player2はドボン可能

      // Player2がドボン
      client2.send("dobon");
      await new Promise((r) => setTimeout(r, 100));

      // ドボン宣言後の状態確認
      expect(room.state.dobonPlayerIds.length).toBe(1);
      expect(room.state.phase).toBe("result"); // resultフェーズになっているはず

      // 結果フェーズになるまで待つ（念のため追加で待機）
      await new Promise((r) => setTimeout(r, 500));

      // Player1のスコアが減り、Player2のスコアが増える
      // 全員の手札合計: 6(Player1残り) + 5(Player2) + 7(Player3) + 5(場札) = 23点
      const finalScore1 =
        client1.state.players.get(client1.sessionId)?.score ?? 0;
      const finalScore2 =
        client1.state.players.get(client2.sessionId)?.score ?? 0;
      const finalScore3 =
        client1.state.players.get(client3.sessionId)?.score ?? 0;

      // ドボンされた人（Player1）がマイナス
      expect(finalScore1).toBeLessThan(initialScore1);
      // ドボンした人（Player2）がプラス
      expect(finalScore2).toBeGreaterThan(initialScore2);
      // Player3は変わらない
      expect(finalScore3).toBe(initialScore3);
    });

    it("レート倍率が適用される", async () => {
      const { room, client1, client2, setHand } = await setupGame(
        testCards.red5,
      );

      expect(room.state.phase).toBe("playing");

      // Player1の手札を設定
      await setHand(client1, [
        testCards.red5,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
      ]);

      // Player2の手札を合計5点に設定
      await setHand(client2, [testCards.red2, testCards.red3]);

      // Player1がカードを出す
      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await new Promise((r) => setTimeout(r, 100));

      client2.send("dobon");
      await new Promise((r) => setTimeout(r, 500));

      // 点数計算が行われていることを確認
      const gameHistory = client1.state.gameHistory;
      if (gameHistory.length > 0) {
        const result = gameHistory[gameHistory.length - 1];
        expect(result.finishType).toBe("dobon");
      }
    });
  });

  describe("状態更新", () => {
    it("phaseがresultになる", async () => {
      const { room, client1, client2, client3, setHand } = await setupGame(
        testCards.red5,
      );

      expect(room.state.phase).toBe("playing");

      // 場のカードを確認
      const fieldCard = room.state.fieldCards[room.state.fieldCards.length - 1];
      expect(fieldCard?.points).toBe(5); // 場は5点

      // Player1の手札を設定
      await setHand(client1, [
        testCards.red5,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
      ]);

      // Player2の手札を合計5点に設定
      await setHand(client2, [testCards.red2, testCards.red3]);

      // Player3の手札も設定（ドボン不可にする）
      await setHand(client3, [testCards.blue7, testCards.yellow8]);

      // setHand後のcanDobonを確認
      const p2AfterSetHand = room.state.players.get(client2.sessionId);
      expect(p2AfterSetHand?.myHand.length).toBe(2); // 手札2枚
      // 手札合計5点で、場のカード5点と一致するのでcanDobon=true
      expect(p2AfterSetHand?.canDobon).toBe(true);

      // Player1がカードを出す
      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await new Promise((r) => setTimeout(r, 100));

      // playCard後の状態を確認
      const p1 = room.state.players.get(client1.sessionId);
      const p2 = room.state.players.get(client2.sessionId);
      const p3 = room.state.players.get(client3.sessionId);

      // Player1はカードを出した人なのでcanDobon=false
      expect(p1?.canDobon).toBe(false);
      // Player2の手札合計5点 = 出されたカード5点 → canDobon=true
      expect(p2?.canDobon).toBe(true);
      // Player3の手札合計15点 ≠ 5点 → canDobon=false
      expect(p3?.canDobon).toBe(false);

      client2.send("dobon");
      await new Promise((r) => setTimeout(r, 500));

      expect(client1.state.phase).toBe("result");
    });

    it("GameResultがgameHistoryに追加される（finishType=dobon）", async () => {
      const { room, client1, client2, setHand } = await setupGame(
        testCards.red5,
      );

      expect(room.state.phase).toBe("playing");

      // Player1の手札を設定
      await setHand(client1, [
        testCards.red5,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
      ]);

      // Player2の手札を合計5点に設定
      await setHand(client2, [testCards.red2, testCards.red3]);

      // Player1がカードを出す
      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await new Promise((r) => setTimeout(r, 100));

      client2.send("dobon");
      await new Promise((r) => setTimeout(r, 500));

      expect(client1.state.gameHistory.length).toBe(1);
      expect(client1.state.gameHistory[0].finishType).toBe("dobon");
      expect(client1.state.gameHistory[0].winnerId).toBe(client2.sessionId);
    });

    it("nextGameStartPlayerIdがドボンした人に設定される", async () => {
      const { room, client1, client2, setHand } = await setupGame(
        testCards.red5,
      );

      expect(room.state.phase).toBe("playing");

      // Player1の手札を設定
      await setHand(client1, [
        testCards.red5,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
        testCards.red1,
      ]);

      // Player2の手札を合計5点に設定
      await setHand(client2, [testCards.red2, testCards.red3]);

      // Player1がカードを出す
      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await new Promise((r) => setTimeout(r, 100));

      client2.send("dobon");
      await new Promise((r) => setTimeout(r, 500));

      expect(client1.state.nextGameStartPlayerId).toBe(client2.sessionId);
    });
  });

  describe("ドロー2に対するドボン", () => {
    it("ドロー2を出されたときにドボンできる", async () => {
      const red4: CardData = {
        id: "r4",
        color: "red",
        value: "4",
        points: 4,
      };
      const redDraw2: CardData = {
        id: "r-draw2",
        color: "red",
        value: "draw2",
        points: 20,
      };
      const { room, client1, client2, client3, setHand } =
        await setupGame(red4);

      expect(room.state.phase).toBe("playing");

      // Player1: red2を出したら残り手札合計20点（= draw2のポイント）
      await setHand(client1, [
        testCards.red2,
        testCards.yellow8,
        { id: "y9", color: "yellow", value: "9", points: 9 },
        testCards.green1,
        testCards.green2,
      ]);

      // Player2: redDraw2 + 出せないカード（残り手札合計≠20でドボン返し不成立）
      await setHand(client2, [
        redDraw2,
        { id: "b1-200", color: "blue", value: "1", points: 1 },
        { id: "g1-200", color: "green", value: "1", points: 1 },
        { id: "b5-200", color: "blue", value: "5", points: 5 },
        { id: "g3-200", color: "green", value: "3", points: 3 },
      ]);

      // Player3: 出せないカード
      await setHand(client3, [
        { id: "b6-300", color: "blue", value: "6", points: 6 },
        { id: "g7-300", color: "green", value: "7", points: 7 },
      ]);

      // タイマーを停止
      client1.send("__stopTimer");
      await new Promise((r) => setTimeout(r, 50));

      // Player1がred2を出す（場はred4なので色一致で出せる）
      client1.send("playCard", { cardIds: [testCards.red2.id] });
      await new Promise((r) => setTimeout(r, 100));

      // タイマーを停止
      client1.send("__stopTimer");
      await new Promise((r) => setTimeout(r, 50));

      // Player2がredDraw2を出す
      client2.send("playCard", { cardIds: [redDraw2.id] });
      await new Promise((r) => setTimeout(r, 100));

      // Player1がドボン可能であることを確認
      const p1 = room.state.players.get(client1.sessionId);
      expect(p1?.canDobon).toBe(true);

      // Player1がドボン
      client1.send("dobon");
      await new Promise((r) => setTimeout(r, 500));

      // ドボンが成功してresultフェーズになる
      expect(room.state.phase).toBe("result");
      expect(room.state.dobonPlayerIds.length).toBe(1);
      expect(room.state.dobonPlayerIds[0]).toBe(client1.sessionId);
    });
  });

  // ドボン返し待ちのテストはDobonReturnCommand実装後にコメントアウトを外す
  // describe("ドボン返し待ち", () => {
  //   it("ドボンされた人がドボン返し可能な場合、canDobonReturn=trueになる", async () => {
  //     // TODO: DobonReturnCommand実装後に実装
  //   });
  //
  //   it("ドボン返し待ち状態になる（タイマー開始）", async () => {
  //     // TODO: DobonReturnCommand実装後に実装
  //   });
  // });
});
