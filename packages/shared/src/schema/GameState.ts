import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { Card } from "./Card";
import { GameResult } from "./GameResult";
import { Player } from "./Player";

export class GameState extends Schema {
  // 基本情報
  @type("string") roomId: string = "";
  @type("string") phase: string = "waiting"; // waiting/playing/result
  @type({ map: Player }) players = new MapSchema<Player>();

  // ゲーム進行
  @type("number") deckCount: number = 0; // 山札の枚数（全員に見える）
  @type([Card]) discardPile = new ArraySchema<Card>(); // 捨て札
  @type([Card]) fieldCards = new ArraySchema<Card>(); // 場のカード（最新のみ表示）
  @type("string") currentColor: string = ""; // 現在有効な色
  @type("string") currentTurnPlayerId: string = ""; // 現在の手番プレイヤー
  @type("number") turnDirection: number = 1; // 1=時計回り, -1=反時計回り

  // ドロー累積
  @type("number") drawStack: number = 0; // 累積ドロー枚数（2, 4, 6, ...）

  // ゲーム設定
  @type("number") rateMultiplier: number = 1; // レート倍率（山札切れで2^n倍）
  @type("number") consecutiveDeckouts: number = 0; // 連続山札切れ回数
  @type("string") nextGameStartPlayerId: string = ""; // 次ゲームの開始プレイヤー

  // 状態フラグ
  @type("boolean") waitingForColorChoice: boolean = false;
  @type("boolean") hasDrawnThisTurn: boolean = false; // 今ターン山札を引いたか

  // 履歴
  @type([GameResult]) gameHistory = new ArraySchema<GameResult>(); // ゲーム結果の履歴
}
