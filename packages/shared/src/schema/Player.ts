import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { Card } from "./Card";

export class Player extends Schema {
  // 全員に見える情報
  @type("string") sessionId: string = "";
  @type("string") name: string = "";
  @type("number") seatId: number = 0; // 座席番号（1-6、固定）
  @type("number") handCount: number = 0; // 手札枚数
  @type("number") score: number = 0; // 累計スコア
  @type("boolean") isOwner: boolean = false;
  @type("boolean") isConnected: boolean = true;
  @type("boolean") isReady: boolean = false;
  @type("number") turnOrder: number = 0; // 手番順（リバースで動的に変わる）
  @type("number") timeRemaining: number = 0; // タイマー残り秒数（0なら非アクティブ）

  // 自分だけに見える情報（@view()は実装時にfilterで処理）
  @type([Card]) myHand = new ArraySchema<Card>();
  @type("boolean") canPass: boolean = false;
  @type("boolean") canDraw: boolean = false;
  @type("boolean") canChooseColor: boolean = false;
  @type("boolean") canDobon: boolean = false;
  @type("boolean") canDobonReturn: boolean = false;
  @type("boolean") canDrawStack: boolean = false;
  @type({ map: "boolean" }) playableCards = new MapSchema<boolean>(); // cardId -> 出せるか
}
