import { GameState, Player } from "@dobon-uno/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TIMING } from "../config/timing";
import { TurnTimerService } from "./TurnTimerService";

describe("TurnTimerService", () => {
  let state: GameState;
  let timerService: TurnTimerService;

  beforeEach(() => {
    vi.useFakeTimers();
    state = new GameState();
    timerService = new TurnTimerService(state);
  });

  afterEach(() => {
    timerService.stopAllTimers();
    vi.useRealTimers();
  });

  function addPlayer(sessionId: string): Player {
    const player = new Player();
    player.sessionId = sessionId;
    state.players.set(sessionId, player);
    return player;
  }

  describe("startTimer", () => {
    it("プレイヤーのtimeRemainingが設定される", () => {
      const player = addPlayer("player1");
      expect(player.timeRemaining).toBe(0);

      timerService.startTimer("player1", () => {});

      expect(player.timeRemaining).toBeGreaterThan(0);
    });

    it("タイマーがアクティブになる", () => {
      addPlayer("player1");
      expect(timerService.isTimerActive("player1")).toBe(false);

      timerService.startTimer("player1", () => {});

      expect(timerService.isTimerActive("player1")).toBe(true);
    });

    it("存在しないプレイヤーIDでは何も起きない", () => {
      const callback = vi.fn();

      timerService.startTimer("nonexistent", callback);

      expect(timerService.isTimerActive("nonexistent")).toBe(false);
      vi.advanceTimersByTime(TIMING.TURN_TIMEOUT + 100);
      expect(callback).not.toHaveBeenCalled();
    });

    it("既存タイマーがある場合は上書きされる", () => {
      addPlayer("player1");

      const callback1 = vi.fn();
      const callback2 = vi.fn();

      timerService.startTimer("player1", callback1);
      timerService.startTimer("player1", callback2);

      vi.advanceTimersByTime(TIMING.TURN_TIMEOUT + 100);

      // 最初のコールバックは呼ばれない
      expect(callback1).not.toHaveBeenCalled();
      // 2番目のコールバックのみ呼ばれる
      expect(callback2).toHaveBeenCalledOnce();
    });
  });

  describe("タイムアウト処理", () => {
    it("タイムアウト時にコールバックが実行される", () => {
      addPlayer("player1");
      const callback = vi.fn();

      timerService.startTimer("player1", callback);

      expect(callback).not.toHaveBeenCalled();
      vi.advanceTimersByTime(TIMING.TURN_TIMEOUT);
      expect(callback).toHaveBeenCalledOnce();
    });

    it("タイムアウト時にtimeRemainingが0になる", () => {
      const player = addPlayer("player1");

      timerService.startTimer("player1", () => {});

      expect(player.timeRemaining).toBeGreaterThan(0);
      vi.advanceTimersByTime(TIMING.TURN_TIMEOUT);
      expect(player.timeRemaining).toBe(0);
    });

    it("タイムアウト時にタイマーがクリアされる", () => {
      addPlayer("player1");

      timerService.startTimer("player1", () => {});

      expect(timerService.isTimerActive("player1")).toBe(true);
      vi.advanceTimersByTime(TIMING.TURN_TIMEOUT);
      expect(timerService.isTimerActive("player1")).toBe(false);
    });
  });

  describe("stopTimer", () => {
    it("タイマーを停止するとコールバックが実行されない", () => {
      addPlayer("player1");
      const callback = vi.fn();

      timerService.startTimer("player1", callback);
      timerService.stopTimer("player1");

      vi.advanceTimersByTime(TIMING.TURN_TIMEOUT + 100);
      expect(callback).not.toHaveBeenCalled();
    });

    it("タイマー停止でtimeRemainingが0になる", () => {
      const player = addPlayer("player1");

      timerService.startTimer("player1", () => {});
      expect(player.timeRemaining).toBeGreaterThan(0);

      timerService.stopTimer("player1");
      expect(player.timeRemaining).toBe(0);
    });

    it("タイマー停止でisTimerActiveがfalseになる", () => {
      addPlayer("player1");

      timerService.startTimer("player1", () => {});
      expect(timerService.isTimerActive("player1")).toBe(true);

      timerService.stopTimer("player1");
      expect(timerService.isTimerActive("player1")).toBe(false);
    });

    it("存在しないプレイヤーIDでも安全に呼べる", () => {
      expect(() => timerService.stopTimer("nonexistent")).not.toThrow();
    });

    it("プレイヤーは存在するがタイマーがない場合もtimeRemainingを0にする", () => {
      const player = addPlayer("player1");
      player.timeRemaining = 5; // 何らかの値が設定されている場合

      timerService.stopTimer("player1");

      expect(player.timeRemaining).toBe(0);
    });
  });

  describe("stopAllTimers", () => {
    it("全プレイヤーのタイマーが停止する", () => {
      addPlayer("player1");
      addPlayer("player2");
      addPlayer("player3");

      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      timerService.startTimer("player1", callback1);
      timerService.startTimer("player2", callback2);
      timerService.startTimer("player3", callback3);

      expect(timerService.getActiveTimerCount()).toBe(3);

      timerService.stopAllTimers();

      expect(timerService.getActiveTimerCount()).toBe(0);
      vi.advanceTimersByTime(TIMING.TURN_TIMEOUT + 100);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).not.toHaveBeenCalled();
    });

    it("全プレイヤーのtimeRemainingが0になる", () => {
      const player1 = addPlayer("player1");
      const player2 = addPlayer("player2");

      timerService.startTimer("player1", () => {});
      timerService.startTimer("player2", () => {});

      expect(player1.timeRemaining).toBeGreaterThan(0);
      expect(player2.timeRemaining).toBeGreaterThan(0);

      timerService.stopAllTimers();

      expect(player1.timeRemaining).toBe(0);
      expect(player2.timeRemaining).toBe(0);
    });
  });

  describe("複数プレイヤーのタイマー", () => {
    it("各プレイヤーが独立したタイマーを持てる", () => {
      addPlayer("player1");
      addPlayer("player2");

      const callback1 = vi.fn();
      const callback2 = vi.fn();

      timerService.startTimer("player1", callback1);
      timerService.startTimer("player2", callback2);

      expect(timerService.getActiveTimerCount()).toBe(2);
    });

    it("一方のタイマーを停止しても他方には影響しない", () => {
      addPlayer("player1");
      addPlayer("player2");

      const callback1 = vi.fn();
      const callback2 = vi.fn();

      timerService.startTimer("player1", callback1);
      timerService.startTimer("player2", callback2);

      timerService.stopTimer("player1");

      expect(timerService.isTimerActive("player1")).toBe(false);
      expect(timerService.isTimerActive("player2")).toBe(true);

      vi.advanceTimersByTime(TIMING.TURN_TIMEOUT);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledOnce();
    });
  });

  describe("getActiveTimerCount", () => {
    it("初期状態では0", () => {
      expect(timerService.getActiveTimerCount()).toBe(0);
    });

    it("タイマー開始で増加", () => {
      addPlayer("player1");

      timerService.startTimer("player1", () => {});

      expect(timerService.getActiveTimerCount()).toBe(1);
    });

    it("タイマー停止で減少", () => {
      addPlayer("player1");
      addPlayer("player2");

      timerService.startTimer("player1", () => {});
      timerService.startTimer("player2", () => {});

      expect(timerService.getActiveTimerCount()).toBe(2);

      timerService.stopTimer("player1");

      expect(timerService.getActiveTimerCount()).toBe(1);
    });
  });
});
