import { MapSchema, Schema, type } from "@colyseus/schema";

export class GameResult extends Schema {
  @type("number") gameNumber: number = 0; // ゲーム番号（1から開始）
  @type({ map: "number" }) scoreChanges = new MapSchema<number>(); // sessionId -> 得点変動
  @type("number") timestamp: number = 0; // ゲーム終了時刻（ミリ秒）
}
