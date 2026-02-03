import { tool } from "ai";
import { z } from "zod";

export const cpuTools = {
  playCard: tool({
    description: "手札からカードを出す。重ね出しも可能。",
    parameters: z.object({
      cardIds: z
        .array(z.string())
        .describe("出すカードのID配列（重ね出しの場合は複数）"),
    }),
  }),

  drawCard: tool({
    description: "山札から1枚カードを引く。",
    parameters: z.object({}),
  }),

  drawStack: tool({
    description: "累積されたドローカード分をすべて引く（Draw2/Draw4効果）。",
    parameters: z.object({}),
  }),

  pass: tool({
    description:
      "パスして次のプレイヤーにターンを渡す。山札を引いた後のみ可能。",
    parameters: z.object({}),
  }),

  dobon: tool({
    description:
      "ドボンを宣言する。手札の合計点数が場のカードと一致する時のみ可能。",
    parameters: z.object({}),
  }),

  dobonReturn: tool({
    description: "ドボン返しを宣言する。",
    parameters: z.object({}),
  }),

  chooseColor: tool({
    description:
      "ワイルドカードやドロー4を出した後に、次の有効な色を選択する。",
    parameters: z.object({
      color: z.enum(["red", "blue", "green", "yellow"]).describe("選択する色"),
    }),
  }),
};
