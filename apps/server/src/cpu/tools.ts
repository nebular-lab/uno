import { tool } from "ai";
import { z } from "zod";

export const cpuTools = {
  playCard: tool({
    description: "手札からカードを1枚出す",
    inputSchema: z.object({
      cardId: z.string(),
    }),
  }),

  drawCard: tool({
    description: "山札から1枚カードを引く。",
    inputSchema: z.object({}),
  }),

  drawStack: tool({
    description: "累積されたドローカード分をすべて引く（Draw2/Draw4効果）。",
    inputSchema: z.object({}),
  }),

  pass: tool({
    description:
      "パスして次のプレイヤーにターンを渡す。山札を引いた後のみ可能。",
    inputSchema: z.object({}),
  }),

  dobon: tool({
    description:
      "ドボンを宣言する。手札の合計点数が場のカードと一致する時のみ可能。",
    inputSchema: z.object({}),
  }),

  dobonReturn: tool({
    description: "ドボン返しを宣言する。",
    inputSchema: z.object({}),
  }),

  chooseColor: tool({
    description:
      "ワイルドカードやドロー4を出した後に、次の有効な色を選択する。",
    inputSchema: z.object({
      color: z.enum(["red", "blue", "green", "yellow"]),
    }),
  }),
};
