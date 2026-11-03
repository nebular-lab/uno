import type { GameState } from "@dobon-uno/shared";
import type { Clock, GameHost } from "./GameHost";

/**
 * ゲームの1操作を表すコマンド
 * （@colyseus/command と同じ書き方ができる、サーバーに依存しない実装）
 */
export abstract class Command<Payload = unknown> {
  payload!: Payload;
  room!: GameHost;
  state!: GameState;
  clock!: Clock;

  setPayload(payload: Payload): this {
    this.payload = payload;
    return this;
  }

  validate?(payload: Payload): boolean;

  // 戻り値（またはPromiseの結果）のコマンドは続けて実行される
  abstract execute(payload: Payload): unknown;

  /** 指定した時間だけ待つ */
  protected delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) =>
      this.clock.setTimeout(() => resolve(), milliseconds),
    );
  }
}

/**
 * コマンドを実行する
 */
export class Dispatcher {
  private stopped = false;

  constructor(private readonly room: GameHost) {}

  stop(): void {
    this.stopped = true;
  }

  dispatch<P>(command: Command<P>, payload?: P): Promise<unknown> | undefined {
    if (this.stopped) return undefined;

    command.room = this.room;
    command.state = this.room.state;
    command.clock = this.room.clock;
    if (payload) {
      command.setPayload(payload);
    }
    if (command.validate && !command.validate(command.payload)) {
      return undefined;
    }

    const result = command.execute(command.payload);
    if (result instanceof Promise) {
      return result.then(async (children) => {
        for (const next of toArray(children)) {
          await this.dispatch(next);
        }
      });
    }

    let lastResult: Promise<unknown> | undefined;
    for (const next of toArray(result)) {
      if (lastResult instanceof Promise) {
        lastResult = lastResult.then(() => this.dispatch(next));
      } else {
        lastResult = this.dispatch(next);
      }
    }
    return lastResult;
  }
}

const toArray = (result: unknown): Command[] => {
  if (result instanceof Command) return [result];
  if (Array.isArray(result)) {
    return result.filter((r): r is Command => r instanceof Command);
  }
  return [];
};
