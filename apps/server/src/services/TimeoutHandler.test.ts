import type { Dispatcher } from "@colyseus/command";
import { GameState, Player } from "@dobon-uno/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChooseColorCommand } from "../commands/ChooseColorCommand";
import { DrawCardCommand } from "../commands/DrawCardCommand";
import { DrawStackCommand } from "../commands/DrawStackCommand";
import { PassCommand } from "../commands/PassCommand";
import type { GameRoom } from "../rooms/GameRoom";
import { TimeoutHandler } from "./TimeoutHandler";

describe("TimeoutHandler", () => {
  let state: GameState;
  let dispatcher: Dispatcher<GameRoom>;
  let handler: TimeoutHandler;
  const playerId = "player1";

  beforeEach(() => {
    state = new GameState();
    state.phase = "playing";
    state.currentTurnPlayerId = playerId;

    // プレイヤーを追加
    const player = new Player();
    player.sessionId = playerId;
    player.seatId = 1;
    state.players.set(playerId, player);

    // Dispatcherをモック
    dispatcher = {
      dispatch: vi.fn(),
    } as unknown as Dispatcher<GameRoom>;

    handler = new TimeoutHandler(state, dispatcher);
  });

  describe("handle", () => {
    it("色選択待ちの場合、ランダムに色を選択する", () => {
      state.waitingForColorChoice = true;

      handler.handle(playerId);

      expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
      const [command, payload] = (
        dispatcher.dispatch as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      expect(command).toBeInstanceOf(ChooseColorCommand);
      expect(payload.sessionId).toBe(playerId);
      expect(["red", "blue", "green", "yellow"]).toContain(payload.color);
    });

    it("ドロースタックがある場合、累積分を引く", () => {
      state.waitingForColorChoice = false;
      state.drawStack = 4;

      handler.handle(playerId);

      expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
      const [command, payload] = (
        dispatcher.dispatch as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      expect(command).toBeInstanceOf(DrawStackCommand);
      expect(payload.sessionId).toBe(playerId);
    });

    it("既にカードを引いている場合、パスする", () => {
      state.waitingForColorChoice = false;
      state.drawStack = 0;
      state.hasDrawnThisTurn = true;

      handler.handle(playerId);

      expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
      const [command, payload] = (
        dispatcher.dispatch as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      expect(command).toBeInstanceOf(PassCommand);
      expect(payload.sessionId).toBe(playerId);
    });

    it("それ以外の場合、カードを1枚引く", () => {
      state.waitingForColorChoice = false;
      state.drawStack = 0;
      state.hasDrawnThisTurn = false;

      handler.handle(playerId);

      expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
      const [command, payload] = (
        dispatcher.dispatch as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      expect(command).toBeInstanceOf(DrawCardCommand);
      expect(payload.sessionId).toBe(playerId);
    });

    it("優先順位: 色選択 > ドロースタック > パス > ドロー", () => {
      // 全条件が揃っていても色選択が最優先
      state.waitingForColorChoice = true;
      state.drawStack = 4;
      state.hasDrawnThisTurn = true;

      handler.handle(playerId);

      const [command] = (dispatcher.dispatch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(command).toBeInstanceOf(ChooseColorCommand);
    });
  });
});
