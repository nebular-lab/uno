import { describe, expect, it } from "vitest";
import { createDeck, shuffleDeck } from "./deck";

describe("createDeck", () => {
  it("112枚のカードを生成する", () => {
    const deck = createDeck();
    expect(deck.length).toBe(112);
  });

  it("数字カードが76枚ある", () => {
    const deck = createDeck();
    const numberCards = deck.filter((card) =>
      ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(card.value),
    );
    expect(numberCards.length).toBe(76);
  });

  it("0は各色1枚ずつ（計4枚）", () => {
    const deck = createDeck();
    const zeros = deck.filter((card) => card.value === "0");
    expect(zeros.length).toBe(4);
    expect(new Set(zeros.map((c) => c.color)).size).toBe(4);
  });

  it("1-9は各色2枚ずつ（各数字8枚）", () => {
    const deck = createDeck();
    for (let n = 1; n <= 9; n++) {
      const cards = deck.filter((card) => card.value === String(n));
      expect(cards.length).toBe(8);
    }
  });

  it("記号カードが24枚ある（skip, reverse, draw2 各色2枚）", () => {
    const deck = createDeck();
    const actionCards = deck.filter((card) =>
      ["skip", "reverse", "draw2"].includes(card.value),
    );
    expect(actionCards.length).toBe(24);
  });

  it("ワイルドカードが4枚ある", () => {
    const deck = createDeck();
    const wilds = deck.filter(
      (card) => card.color === "wild" && card.value === "wild",
    );
    expect(wilds.length).toBe(4);
  });

  it("ドロー4が4枚ある", () => {
    const deck = createDeck();
    const draw4s = deck.filter((card) => card.value === "draw4");
    expect(draw4s.length).toBe(4);
  });

  it("強制色変えカードが4枚ある（各色1枚）", () => {
    const deck = createDeck();
    const forceChanges = deck.filter((card) => card.value === "force-change");
    expect(forceChanges.length).toBe(4);
    expect(new Set(forceChanges.map((c) => c.color)).size).toBe(4);
  });

  it("全てのカードにユニークなIDがある", () => {
    const deck = createDeck();
    const ids = deck.map((card) => card.id);
    expect(new Set(ids).size).toBe(112);
  });

  it("カードに正しい点数が設定されている", () => {
    const deck = createDeck();

    // 数字カードの点数
    const five = deck.find((card) => card.value === "5");
    expect(five?.points).toBe(5);

    // 記号カードの点数
    const skip = deck.find((card) => card.value === "skip");
    expect(skip?.points).toBe(20);

    // ワイルドの点数
    const wild = deck.find((card) => card.value === "wild");
    expect(wild?.points).toBe(30);

    // ドロー4の点数
    const draw4 = deck.find((card) => card.value === "draw4");
    expect(draw4?.points).toBe(50);

    // 強制色変えの点数
    const forceChange = deck.find((card) => card.value === "force-change");
    expect(forceChange?.points).toBe(10);
  });
});

describe("shuffleDeck", () => {
  it("シャッフル後も枚数が同じ", () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled.length).toBe(deck.length);
  });

  it("元の配列を変更しない", () => {
    const deck = createDeck();
    const originalFirst = deck[0];
    const originalLast = deck[deck.length - 1];

    shuffleDeck(deck, 12345);

    expect(deck[0]).toBe(originalFirst);
    expect(deck[deck.length - 1]).toBe(originalLast);
  });

  it("同じseedなら同じ結果を返す", () => {
    const deck = createDeck();
    const shuffled1 = shuffleDeck(deck, 12345);
    const shuffled2 = shuffleDeck(deck, 12345);

    expect(shuffled1.map((c) => c.id)).toEqual(shuffled2.map((c) => c.id));
  });

  it("異なるseedなら異なる結果を返す", () => {
    const deck = createDeck();
    const shuffled1 = shuffleDeck(deck, 12345);
    const shuffled2 = shuffleDeck(deck, 54321);

    expect(shuffled1.map((c) => c.id)).not.toEqual(shuffled2.map((c) => c.id));
  });

  it("seedなしでは毎回異なる結果を返す（高確率）", () => {
    const deck = createDeck();
    const shuffled1 = shuffleDeck(deck);
    const shuffled2 = shuffleDeck(deck);

    // 112枚が完全に同じ順番になる確率は極めて低い
    expect(shuffled1.map((c) => c.id)).not.toEqual(shuffled2.map((c) => c.id));
  });

  it("シャッフル後も全てのカードが含まれている", () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck, 99999);

    const originalIds = new Set(deck.map((c) => c.id));
    const shuffledIds = new Set(shuffled.map((c) => c.id));

    expect(shuffledIds).toEqual(originalIds);
  });
});
