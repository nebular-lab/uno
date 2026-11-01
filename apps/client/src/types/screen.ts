// 画面の種類
export type ScreenType =
  | "title"
  | "lobby"
  | "createRoom"
  | "waitingRoom"
  | "game";

// 画面状態（Discriminated Union）
export type ScreenState =
  | { screen: "title" }
  | { screen: "lobby" }
  | { screen: "createRoom" }
  | { screen: "waitingRoom"; roomId: string }
  | { screen: "game"; roomId: string };

// プレイヤー情報
export interface PlayerInfo {
  name: string;
}
