import { Card, GameState, Player } from "@dobon-uno/shared";
import { describe, expect, it, vi } from "vitest";
import {
  JevActionDecider,
  type JevPlan,
  planJevRequest,
  toDecision,
} from "./JevActionDecider";

// テスト用プレイヤー作成ヘルパー
function createPlayer(sessionId: string, cards: Card[] = []): Player {
  const player = new Player();
  player.sessionId = sessionId;
  player.name = sessionId;
  for (const card of cards) {
    player.myHand.push(card);
  }
  player.handCount = cards.length;
  return player;
}

// CPUと相手1人のGameStateを作成
function createState(cpu: Player, opponentHandCount = 5): GameState {
  const state = new GameState();
  state.fieldCards.push(new Card("r7", "red", "7", 7));
  state.currentColor = "red";
  const opponent = createPlayer("opponent");
  opponent.handCount = opponentHandCount;
  state.players.set(cpu.sessionId, cpu);
  state.players.set(opponent.sessionId, opponent);
  return state;
}

function setPlayable(player: Player, ...ids: string[]): void {
  for (const id of ids) {
    player.playableCards.set(id, true);
  }
}

function askPlan(plan: JevPlan): Extract<JevPlan, { kind: "ask" }> {
  if (plan.kind !== "ask") throw new Error("expected ask plan");
  return plan;
}

describe("planJevRequest", () => {
  it("ドボン可能ならAPIを呼ばずにドボンする", () => {
    const cpu = createPlayer("cpu");
    cpu.canDobon = true;
    cpu.canDraw = true;

    const plan = planJevRequest(createState(cpu), cpu);

    expect(plan).toEqual({ kind: "fixed", decision: { action: "dobon" } });
  });

  it("行動が1つだけならAPIを呼ばずに決める", () => {
    const cpu = createPlayer("cpu", [new Card("b3", "blue", "3", 3)]);
    cpu.canDraw = true;

    const plan = planJevRequest(createState(cpu), cpu);

    expect(plan).toEqual({ kind: "fixed", decision: { action: "drawCard" } });
  });

  it("出せるカードが1枚で他の行動がなければそのカードを出す", () => {
    const cpu = createPlayer("cpu", [new Card("r5", "red", "5", 5)]);
    setPlayable(cpu, "r5");

    const plan = planJevRequest(createState(cpu), cpu);

    expect(plan).toEqual({
      kind: "fixed",
      decision: { action: "playCard", params: { cardId: "r5" } },
    });
  });

  it("出せるカードだけをカードの選択肢にする", () => {
    const cpu = createPlayer("cpu", [
      new Card("r5", "red", "5", 5),
      new Card("r-skip", "red", "skip", 20),
      new Card("b3", "blue", "3", 3),
    ]);
    setPlayable(cpu, "r5", "r-skip");
    cpu.canDraw = true;

    const plan = askPlan(planJevRequest(createState(cpu), cpu));

    expect(Object.keys(plan.questions.action?.criteria ?? {})).toEqual([
      "playCard",
      "drawCard",
    ]);
    expect(Object.keys(plan.questions.card?.criteria ?? {})).toEqual([
      "r5",
      "r-skip",
    ]);
  });

  it("出した後の手札合計とドボンの危険を選択肢の説明に含める", () => {
    const cpu = createPlayer("cpu", [
      new Card("r5", "red", "5", 5),
      new Card("r-skip", "red", "skip", 20),
    ]);
    setPlayable(cpu, "r5", "r-skip");

    // 相手の手札2枚: 0〜9点は危険、20点は安全
    const plan = askPlan(planJevRequest(createState(cpu, 2), cpu));
    const criteria = plan.questions.card?.criteria ?? {};

    expect(criteria.r5).toContain("出した後の手札合計は20点でドボンを狙える");
    expect(criteria.r5).toContain("opponentにドボンされる恐れがある");
    expect(criteria["r-skip"]).toContain("出した後の手札合計は5点");
    expect(criteria["r-skip"]).toContain("ドボンされる恐れは低い");
  });

  it("色選択が必要なら色だけを質問する", () => {
    const cpu = createPlayer("cpu", [new Card("g1", "green", "1", 1)]);
    cpu.canChooseColor = true;
    cpu.canDraw = true;

    const plan = askPlan(planJevRequest(createState(cpu), cpu));

    expect(Object.keys(plan.questions)).toEqual(["color"]);
    expect(plan.questions.color?.criteria.green).toBe("green。手札に1枚ある");
  });
});

describe("toDecision", () => {
  const cpu = createPlayer("cpu", [
    new Card("r5", "red", "5", 5),
    new Card("r6", "red", "6", 6),
  ]);
  setPlayable(cpu, "r5", "r6");
  cpu.canDraw = true;
  const plan = askPlan(planJevRequest(createState(cpu), cpu));

  it("playCardなら選ばれたカードを出す", () => {
    const decision = toDecision(plan, {
      action: { choice: "playCard" },
      card: { choice: "r6" },
    });

    expect(decision).toEqual({ action: "playCard", params: { cardId: "r6" } });
  });

  it("playCard以外ならカードの回答は使わない", () => {
    const decision = toDecision(plan, {
      action: { choice: "drawCard" },
      card: { choice: "r6" },
    });

    expect(decision).toEqual({ action: "drawCard" });
  });

  it("選択肢にない回答はエラーにする", () => {
    expect(() =>
      toDecision(plan, {
        action: { choice: "playCard" },
        card: { choice: "b9" },
      }),
    ).toThrow("Jev returned an invalid card");
  });
});

describe("JevActionDecider", () => {
  it("Jevの回答から行動を決めてログに残す", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            model: "jev-1.14.0",
            answers: {
              action: {
                type: "choice",
                choice: "playCard",
                probabilities: { playCard: 0.9, drawCard: 0.1 },
                confidence: 0.85,
              },
              card: {
                type: "choice",
                choice: "r5",
                probabilities: { r5: 0.7, r6: 0.3 },
                confidence: 0.6,
              },
            },
            usage: { input_tokens: 300, output_tokens: 0 },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "x-typesafe-request-id": "req_1",
            },
          },
        ),
    );
    const log = vi.fn();
    const decider = new JevActionDecider({
      clientConfig: { apiKey: "test-key", fetch, compression: false },
      log,
    });

    const cpu = createPlayer("cpu", [
      new Card("r5", "red", "5", 5),
      new Card("r6", "red", "6", 6),
    ]);
    setPlayable(cpu, "r5", "r6");
    cpu.canDraw = true;

    const decision = await decider.decide(createState(cpu), cpu);

    expect(decision).toEqual({ action: "playCard", params: { cardId: "r5" } });
    expect(fetch).toHaveBeenCalledTimes(1);
    const init = (fetch.mock.calls[0] as unknown[])[1] as RequestInit;
    const body = await new Response(init.body).json();
    expect(body.model).toBe("jev-1.14");
    expect(Object.keys(body.questions)).toEqual(["action", "card"]);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req_1", decision }),
    );
  });

  it("選択肢が1つならAPIを呼ばない", async () => {
    const fetch = vi.fn();
    const decider = new JevActionDecider({
      clientConfig: { apiKey: "test-key", fetch },
    });
    const cpu = createPlayer("cpu");
    cpu.canPass = true;

    const decision = await decider.decide(createState(cpu), cpu);

    expect(decision).toEqual({ action: "pass" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
