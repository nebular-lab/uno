import { MapSchema, Schema, type } from "@colyseus/schema";

export class GameResult extends Schema {
  @type("number") gameNumber: number = 0; // ゲーム番号（1から開始）
  @type({ map: "number" }) scoreChanges = new MapSchema<number>(); // sessionId -> 得点変動
  @type({ map: "number" }) handPoints = new MapSchema<number>(); // sessionId -> 終了時の手札合計点数
  @type({ map: "string" }) playerNames = new MapSchema<string>(); // sessionId -> プレイヤー名（退席後も成績表に名前を出すため）
  @type("number") timestamp: number = 0; // ゲーム終了時刻（ミリ秒）
  @type("string") winnerId: string = ""; // 勝者のsessionId
  @type("string") finishType: string = ""; // "normal" | "dobon" | "dobonReturn" | "deckOut"（流局）
  @type("number") rateMultiplier: number = 1; // このゲームのレート倍率
}
