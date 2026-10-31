import type { ColyseusTestServer } from "@colyseus/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bootTestServer } from "../test/setup";
import { RESULT_DISPLAY_DURATION } from "../utils/finishGame";

type CardData = { id: string; color: string; value: string; points: number };

// テスト用カードデータ
const testCards = {
  red5: { id: "r5", color: "red", value: "5", points: 5 },
  red3: { id: "r3", color: "red", value: "3", points: 3 },
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

describe("GameRoom", () => {
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

  // -------------------------------------------------------
  // resetGameState
  // -------------------------------------------------------
  describe("resetGameState", () => {
    it("プレイヤーの手札がクリアされる", async () => {
      const { room, owner, player2, player3, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // 上がり処理を実行
      await setHand(owner, [testCards.red3]);
      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(room.state.phase).toBe("result");

      // 結果表示時間が経過してリセットされるのを待つ
      await new Promise((resolve) =>
        setTimeout(resolve, RESULT_DISPLAY_DURATION + 500),
      );

      // 全プレイヤーの手札がクリアされている
      const ownerPlayer = room.state.players.get(owner.sessionId);
      const p2Player = room.state.players.get(player2.sessionId);
      const p3Player = room.state.players.get(player3.sessionId);

      expect(ownerPlayer?.myHand.length).toBe(0);
      expect(ownerPlayer?.handCount).toBe(0);
      expect(p2Player?.myHand.length).toBe(0);
      expect(p2Player?.handCount).toBe(0);
      expect(p3Player?.myHand.length).toBe(0);
      expect(p3Player?.handCount).toBe(0);

      // 公開された手札もクリアされている
      expect(ownerPlayer?.revealedHand.length).toBe(0);
      expect(p2Player?.revealedHand.length).toBe(0);
      expect(p3Player?.revealedHand.length).toBe(0);
    });

    it("ゲーム状態がリセットされる", async () => {
      const { room, owner, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // 上がり処理を実行
      await setHand(owner, [testCards.red3]);
      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(room.state.phase).toBe("result");

      // 結果表示時間が経過してリセットされるのを待つ
      await new Promise((resolve) =>
        setTimeout(resolve, RESULT_DISPLAY_DURATION + 500),
      );

      // ゲーム状態がリセットされている
      expect(room.state.phase).toBe("waiting");
      expect(room.state.fieldCards.length).toBe(0);
      expect(room.state.deckCount).toBe(0);
      expect(room.state.currentColor).toBe("");
      expect(room.state.currentTurnPlayerId).toBe("");
      expect(room.state.turnDirection).toBe(1);
      expect(room.state.drawStack).toBe(0);
      expect(room.state.waitingForColorChoice).toBe(false);
      expect(room.state.hasDrawnThisTurn).toBe(false);
    });

    it("プレイヤーのアクションフラグがリセットされる", async () => {
      const { room, owner, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // 上がり処理を実行
      await setHand(owner, [testCards.red3]);
      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 結果表示時間が経過してリセットされるのを待つ
      await new Promise((resolve) =>
        setTimeout(resolve, RESULT_DISPLAY_DURATION + 500),
      );

      // 全プレイヤーのアクションフラグがリセットされている
      for (const player of room.state.players.values()) {
        expect(player.canPass).toBe(false);
        expect(player.canDraw).toBe(false);
        expect(player.canChooseColor).toBe(false);
        expect(player.canDobon).toBe(false);
        expect(player.canDobonReturn).toBe(false);
        expect(player.canDrawStack).toBe(false);
        expect(player.playableCards.size).toBe(0);
        expect(player.timeRemaining).toBe(0);
      }
    });
  });

  // -------------------------------------------------------
  // 途中参加の禁止・観戦
  // -------------------------------------------------------
  describe("途中参加の禁止と観戦", () => {
    const wait = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    it("開始前はプレイヤーとして参加でき、メタデータに参加者が載る", async () => {
      const room = await colyseus.createRoom("game", {});
      await colyseus.connectTo(room, { playerName: "Owner" });
      await colyseus.connectTo(room, { playerName: "Player2" });

      expect(room.state.players.size).toBe(2);
      expect(room.metadata).toEqual({
        ownerName: "Owner",
        status: "waiting",
        playerNames: ["Owner", "Player2"],
        spectatorCount: 0,
      });
    });

    it("開始前のルームは観戦できない", async () => {
      const room = await colyseus.createRoom("game", {});
      await colyseus.connectTo(room, { playerName: "Owner" });

      await expect(
        colyseus.connectTo(room, { playerName: "Viewer", spectate: true }),
      ).rejects.toThrow("開始前のルームは観戦できません");
    });

    it("ゲーム開始後はプレイヤーとして参加できない", async () => {
      const { room } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      await expect(
        colyseus.connectTo(room, { playerName: "Late" }),
      ).rejects.toThrow("ゲームが開始されているため参加できません");
      expect(room.state.players.size).toBe(3);
      expect(room.metadata.status).toBe("playing");
    });

    it("ゲーム開始後は観戦者として参加でき、プレイヤーには数えられない", async () => {
      const { room } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      const viewer = await colyseus.connectTo(room, {
        playerName: "Viewer",
        spectate: true,
      });
      await room.waitForNextPatch();

      expect(room.state.players.size).toBe(3);
      expect(room.state.players.has(viewer.sessionId)).toBe(false);
      expect(room.state.spectatorCount).toBe(1);
      expect(room.metadata.spectatorCount).toBe(1);

      // 観戦者には全プレイヤーの手札が同期される（視点表示に使う）
      for (const player of viewer.state.players.values()) {
        expect(player.myHand.length).toBe(7);
      }

      // 観戦者が退出すると人数が戻る
      await viewer.leave();
      await wait(100);
      expect(room.state.spectatorCount).toBe(0);
      expect(room.metadata.spectatorCount).toBe(0);
    });

    it("観戦者の操作は無視される", async () => {
      const { room } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );
      const viewer = await colyseus.connectTo(room, {
        playerName: "Viewer",
        spectate: true,
      });

      const deckCountBefore = room.state.deckCount;
      const turnPlayerBefore = room.state.currentTurnPlayerId;
      viewer.send("drawCard");
      viewer.send("pass");
      viewer.send("dobon");
      await wait(200);

      expect(room.state.deckCount).toBe(deckCountBefore);
      expect(room.state.currentTurnPlayerId).toBe(turnPlayerBefore);
      expect(room.state.phase).toBe("playing");
    });

    it("ゲーム終了後にwaitingへ戻っても進行中のまま、プレイヤーとして参加できない", async () => {
      const { room, owner, setHand } = await setupWithHands(
        testCards.red5,
        dummyHand(100),
        dummyHand(200),
        dummyHand(300),
      );

      // 上がってwaitingに戻るまで待つ
      await setHand(owner, [testCards.red3]);
      owner.send("playCard", { cardIds: [testCards.red3.id] });
      await wait(RESULT_DISPLAY_DURATION + 700);
      expect(room.state.phase).toBe("waiting");

      expect(room.metadata.status).toBe("playing");
      await expect(
        colyseus.connectTo(room, { playerName: "Late" }),
      ).rejects.toThrow("ゲームが開始されているため参加できません");

      // 観戦はできる
      const viewer = await colyseus.connectTo(room, {
        playerName: "Viewer",
        spectate: true,
      });
      expect(viewer.sessionId).toBeTruthy();
    });

    it("人間のプレイヤーが全員退出すると観戦者も切断される", async () => {
      const room = await colyseus.createRoom("game", {});
      const owner = await colyseus.connectTo(room, { playerName: "Owner" });
      owner.send("addCpu", { seatId: 2 });
      owner.send("addCpu", { seatId: 3 });
      await wait(100);
      owner.send("startGame");
      while (room.state.phase === "waiting") {
        await room.waitForNextPatch();
      }

      const viewer = await colyseus.connectTo(room, {
        playerName: "Viewer",
        spectate: true,
      });
      const left = new Promise<number>((resolve) => viewer.onLeave(resolve));

      await owner.leave();
      await expect(left).resolves.toBeTypeOf("number");
    });
  });
});
