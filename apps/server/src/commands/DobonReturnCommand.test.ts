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
  blue5: { id: "b5", color: "blue", value: "5", points: 5 },
  blue2: { id: "b2", color: "blue", value: "2", points: 2 },
  blue1: { id: "b1", color: "blue", value: "1", points: 1 },
  green1: { id: "g1", color: "green", value: "1", points: 1 },
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

describe("DobonReturnCommand", () => {
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

    // タイマーを長めに設定（テスト中にタイムアウトしないように）
    client1.send("__setTurnTimeout", 30000);
    await new Promise((resolve) => setTimeout(resolve, 50));

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
    it("canDobonReturn=falseの場合は拒否される", async () => {
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

      // Player1（カードを出した人）のcanDobonReturnはまだfalse
      const player1 = client1.state.players.get(client1.sessionId);
      expect(player1?.canDobonReturn).toBe(false);

      // ドボン返しを試みる（拒否されるべき）
      client1.send("dobonReturn");
      await new Promise((r) => setTimeout(r, 100));

      // フェーズはplayingのまま
      expect(client1.state.phase).toBe("playing");
    });
  });

  describe("ドボン返し", () => {
    it("ドボン返しするとドボンした人がスコアを失う", async () => {
      const { room, client1, client2, client3, setHand } = await setupGame(
        testCards.red5,
      );

      expect(room.state.phase).toBe("playing");

      // Player1の手札: 5を出すと残り5点（ドボン返し用）
      await setHand(client1, [
        testCards.red5,
        testCards.red2,
        testCards.red3, // 残り5点
      ]);

      // Player2の手札: 合計5点（ドボン可能）
      await setHand(client2, [testCards.red2, testCards.red3]);

      // Player3の手札: 合計10点
      await setHand(client3, [testCards.blue5, testCards.blue5]);

      // 初期スコアを記録
      const initialScore1 = client1.state.players.get(client1.sessionId)?.score;
      const initialScore2 = client2.state.players.get(client2.sessionId)?.score;

      // Player1がカードを出す
      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await new Promise((r) => setTimeout(r, 100));

      // Player2がドボン
      client2.send("dobon");
      await new Promise((r) => setTimeout(r, 100));

      // Player1にcanDobonReturnがtrueになっているはず
      const player1AfterDobon = client1.state.players.get(client1.sessionId);
      expect(player1AfterDobon?.canDobonReturn).toBe(true);

      // Player1がドボン返し
      client1.send("dobonReturn");
      await new Promise((r) => setTimeout(r, 100));

      // resultフェーズに遷移
      expect(client1.state.phase).toBe("result");

      // スコア計算を確認
      // 全員の手札: Player1=2+3=5, Player2=2+3=5, Player3=5+5=10
      // 場のカード: 5
      // 合計: 5 + 5 + 10 + 5 = 25点
      const finalScore1 = client1.state.players.get(client1.sessionId)?.score;
      const finalScore2 = client2.state.players.get(client2.sessionId)?.score;

      // ドボン返しした人（Player1）が25点得る
      expect(finalScore1).toBe((initialScore1 ?? 0) + 25);
      // ドボンした人（Player2）が25点失う
      expect(finalScore2).toBe((initialScore2 ?? 0) - 25);
    });

    it("finishTypeがdobonReturnになる", async () => {
      const { room, client1, client2, client3, setHand } = await setupGame(
        testCards.red5,
      );

      expect(room.state.phase).toBe("playing");

      // Player1の手札: 5を出すと残り5点
      await setHand(client1, [testCards.red5, testCards.red2, testCards.red3]);

      // Player2の手札: 合計5点（ドボン可能）
      await setHand(client2, [testCards.red2, testCards.red3]);

      // Player3の手札
      await setHand(client3, [testCards.blue5, testCards.blue5]);

      // Player1がカードを出す
      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await new Promise((r) => setTimeout(r, 100));

      // Player2がドボン
      client2.send("dobon");
      await new Promise((r) => setTimeout(r, 100));

      // Player1がドボン返し
      client1.send("dobonReturn");
      await new Promise((r) => setTimeout(r, 100));

      // ゲーム履歴を確認
      const gameHistory = client1.state.gameHistory;
      expect(gameHistory.length).toBe(1);
      expect(gameHistory[0].finishType).toBe("dobonReturn");
      expect(gameHistory[0].winnerId).toBe(client1.sessionId);
    });

    it("ドボン返ししなかった場合はタイムアウトでドボン確定", async () => {
      const { room, client1, client2, client3, setHand } = await setupGame(
        testCards.red5,
      );

      expect(room.state.phase).toBe("playing");

      // ドボン返しタイマー用に短いタイムアウトを設定
      client1.send("__setTurnTimeout", 150);
      await new Promise((r) => setTimeout(r, 30));

      // Player1の手札: 5を出すと残り5点（ドボン返し可能な手札）
      // ユニークなIDを使用（他プレイヤーと重複しないように）
      await setHand(client1, [
        testCards.red5,
        { id: "p1-r2", color: "red", value: "2", points: 2 },
        { id: "p1-r3", color: "red", value: "3", points: 3 },
      ]);

      // Player2の手札: 合計5点（ドボン可能）
      await setHand(client2, [
        { id: "p2-r2", color: "red", value: "2", points: 2 },
        { id: "p2-r3", color: "red", value: "3", points: 3 },
      ]);

      // Player3の手札
      await setHand(client3, [testCards.blue5, testCards.blue5]);

      // Player1がカードを出す
      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await new Promise((r) => setTimeout(r, 50));

      // Player2がドボン（これによりドボン返しタイマーが開始される）
      client2.send("dobon");
      await new Promise((r) => setTimeout(r, 30));

      // Player1がドボン返し可能な状態になっているはず
      const player1 = client1.state.players.get(client1.sessionId);
      expect(player1?.canDobonReturn).toBe(true);

      // ドボン返しせずにタイムアウトを待つ（150ms + バッファ）
      await new Promise((r) => setTimeout(r, 250));

      // resultフェーズに遷移（ドボン確定）
      expect(client1.state.phase).toBe("result");

      // finishTypeはdobon（ドボン返しではない）
      const gameHistory = client1.state.gameHistory;
      expect(gameHistory.length).toBe(1);
      expect(gameHistory[0].finishType).toBe("dobon");
      expect(gameHistory[0].winnerId).toBe(client2.sessionId);
    });

    it("複数人ドボンの場合、ドボン返しすると全員から取る", async () => {
      const { room, client1, client2, client3, setHand } = await setupGame(
        testCards.red5,
      );

      expect(room.state.phase).toBe("playing");

      // Player1の手札: 5を出すと残り5点
      await setHand(client1, [testCards.red5, testCards.red2, testCards.red3]);

      // Player2の手札: 合計5点（ドボン可能）
      await setHand(client2, [testCards.red2, testCards.red3]);

      // Player3の手札: 合計5点（ドボン可能）
      await setHand(client3, [
        testCards.blue2,
        testCards.blue1,
        testCards.green1,
        testCards.red1,
      ]);

      // 初期スコアを記録
      const initialScore1 = client1.state.players.get(client1.sessionId)?.score;
      const initialScore2 = client2.state.players.get(client2.sessionId)?.score;
      const initialScore3 = client3.state.players.get(client3.sessionId)?.score;

      // Player1がカードを出す
      client1.send("playCard", { cardIds: [testCards.red5.id] });
      await new Promise((r) => setTimeout(r, 100));

      // Player2とPlayer3がドボン
      client2.send("dobon");
      await new Promise((r) => setTimeout(r, 100));
      client3.send("dobon");
      await new Promise((r) => setTimeout(r, 100));

      // Player1がドボン返し
      client1.send("dobonReturn");
      await new Promise((r) => setTimeout(r, 100));

      // resultフェーズに遷移
      expect(client1.state.phase).toBe("result");

      // スコア計算を確認
      // 全員の手札: Player1=5, Player2=5, Player3=5
      // 場のカード: 5
      // 合計: 5 + 5 + 5 + 5 = 20点
      // ドボンした人が2人なので、ドボン返しで2人分（40点）得る
      const finalScore1 = client1.state.players.get(client1.sessionId)?.score;
      const finalScore2 = client2.state.players.get(client2.sessionId)?.score;
      const finalScore3 = client3.state.players.get(client3.sessionId)?.score;

      // ドボン返しした人（Player1）が20×2=40点得る
      expect(finalScore1).toBe((initialScore1 ?? 0) + 40);
      // ドボンした人（Player2, Player3）がそれぞれ20点失う
      expect(finalScore2).toBe((initialScore2 ?? 0) - 20);
      expect(finalScore3).toBe((initialScore3 ?? 0) - 20);
    });
  });
});
