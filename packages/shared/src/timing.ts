/**
 * ゲーム終了後（resultフェーズ）の表示タイミング
 * サーバー（待機状態に戻るまでの時間）とクライアント（表示の切り替え）で共有する
 */

/** 上がり/ドボンラベル表示時間（ミリ秒） */
export const FINISH_DISPLAY_DURATION = 1500;
/** 手札公開の表示時間（ミリ秒）。ラベル表示後、スコアパネルを開くまで */
export const HAND_REVEAL_DURATION = 3500;
/** スコアパネル表示時間（ミリ秒） */
export const SCORE_DISPLAY_DURATION = 5000;
/** resultフェーズ開始からスコアパネルを開くまでの時間（ミリ秒） */
export const SCORE_PANEL_DELAY = FINISH_DISPLAY_DURATION + HAND_REVEAL_DURATION;
/** 結果表示合計時間（ミリ秒） */
export const RESULT_DISPLAY_DURATION =
  SCORE_PANEL_DELAY + SCORE_DISPLAY_DURATION;
