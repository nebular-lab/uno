import { Card, GameState, Player } from "@dobon-uno/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { PlayerActionUpdater } from "./PlayerActionUpdater";

describe("PlayerActionUpdater", () => {
  let state: GameState;
  let updater: PlayerActionUpdater;
  let player1: Player;
  let player2: Player;

  beforeEach(() => {
    state = new GameState();
    state.phase = "playing";
    state.turnDirection = 1;
    state.currentColor = "red";

    // プレイヤーを追加
    player1 = new Player();
    player1.sessionId = "player1";
    player1.seatId = 1;
    player1.myHand.push(new Card("card1", "red", "5", 5));
    player1.myHand.push(new Card("card2", "blue", "3", 3));
    state.players.set("player1", player1);

    player2 = new Player();
    player2.sessionId = "player2";
    player2.seatId = 3;
    player2.myHand.push(new Card("card3", "red", "7", 7));
    player2.myHand.push(new Card("card4", "green", "2", 2));
    state.players.set("player2", player2);

    state.currentTurnPlayerId = "player1";

    // 場札を設定
    state.fieldCards.push(new Card("field1", "red", "5", 5));

    updater = new PlayerActionUpdater(state);
  });

  describe("update", () => {
    describe("手番プレイヤーのアクション", () => {
      it("通常状態でcanDrawがtrueになる", () => {
        state.waitingForColorChoice = false;
        state.drawStack = 0;

        updater.update();

        expect(player1.canDraw).toBe(true);
      });

      it("色選択待ちの場合canDrawがfalseになる", () => {
        state.waitingForColorChoice = true;
        state.drawStack = 0;

        updater.update();

        expect(player1.canDraw).toBe(false);
      });

      it("ドロースタックがある場合canDrawがfalseになる", () => {
        state.waitingForColorChoice = false;
        state.drawStack = 2;

        updater.update();

        expect(player1.canDraw).toBe(false);
      });

      it("ドロースタックがある場合canDrawStackがtrueになる", () => {
        state.waitingForColorChoice = false;
        state.drawStack = 2;

        updater.update();

        expect(player1.canDrawStack).toBe(true);
      });

      it("色選択待ちの場合canDrawStackがfalseになる", () => {
        state.waitingForColorChoice = true;
        state.drawStack = 2;

        updater.update();

        expect(player1.canDrawStack).toBe(false);
      });

      it("色選択待ちの場合canChooseColorがtrueになる", () => {
        state.waitingForColorChoice = true;

        updater.update();

        expect(player1.canChooseColor).toBe(true);
      });

      it("カードを引いた後canPassがtrueになる", () => {
        state.hasDrawnThisTurn = true;

        updater.update();

        expect(player1.canPass).toBe(true);
      });

      it("出せるカードがplayableCardsに設定される", () => {
        updater.update();

        // red-5は場のred-5と同色・同数字なので出せる
        expect(player1.playableCards.has("card1")).toBe(true);
      });
    });

    describe("非手番プレイヤーのアクション", () => {
      it("canDrawがfalseになる", () => {
        updater.update();

        expect(player2.canDraw).toBe(false);
      });

      it("canDrawStackがfalseになる", () => {
        state.drawStack = 2;

        updater.update();

        expect(player2.canDrawStack).toBe(false);
      });

      it("canChooseColorがfalseになる", () => {
        state.waitingForColorChoice = true;

        updater.update();

        expect(player2.canChooseColor).toBe(false);
      });

      it("canPassがfalseになる", () => {
        updater.update();

        expect(player2.canPass).toBe(false);
      });

      it("カットイン用の出せるカードがplayableCardsに設定される", () => {
        updater.update();

        // カットインは完全一致のみ（red-5）なのでred-7は出せない
        expect(player2.playableCards.has("card3")).toBe(false);
      });
    });

    describe("ドボン判定", () => {
      it("手札合計が場札と一致する場合canDobonがtrueになる", () => {
        // player2の手札: 7 + 2 = 9、場札を9点に変更
        state.fieldCards.splice(0, state.fieldCards.length);
        state.fieldCards.push(new Card("field1", "red", "9", 9));

        updater.update();

        expect(player2.canDobon).toBe(true);
      });

      it("手札合計が場札と一致しない場合canDobonがfalseになる", () => {
        // player2の手札: 7 + 2 = 9、場札は5点
        updater.update();

        expect(player2.canDobon).toBe(false);
      });

      it("cardPlayerIdが指定された場合、そのプレイヤーはドボン不可", () => {
        // player1の手札を5点にして場札5点と一致させる
        player1.myHand.splice(0, player1.myHand.length);
        player1.myHand.push(new Card("card1", "red", "5", 5));

        updater.update({ cardPlayerId: "player1" });

        expect(player1.canDobon).toBe(false);
      });

      it("totalPlayedPointsが指定された場合、その合計でドボン判定する", () => {
        // player2の手札: 7 + 2 = 9、totalPlayedPoints = 9
        updater.update({ totalPlayedPoints: 9 });

        expect(player2.canDobon).toBe(true);
      });
    });

    describe("isFirstCardWildオプション", () => {
      it("最初のカードがワイルドの場合、すべてのカードが出せる", () => {
        // ワイルドカードを場札に設定
        state.fieldCards.splice(0, state.fieldCards.length);
        state.fieldCards.push(new Card("wild1", "wild", "wild", 40));

        updater.update({ isFirstCardWild: true });

        // すべてのカードが出せる
        expect(player1.playableCards.has("card1")).toBe(true);
        expect(player1.playableCards.has("card2")).toBe(true);
      });
    });
  });
});
