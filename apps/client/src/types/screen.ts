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

// アプリ全体の状態
export interface AppState {
  screen: ScreenState;
  player: PlayerInfo | null;
}

// アクション型
export type AppAction =
  | { type: "SET_PLAYER_NAME"; name: string }
  | { type: "NAVIGATE_TO_LOBBY" }
  | { type: "NAVIGATE_TO_CREATE_ROOM" }
  | { type: "NAVIGATE_TO_WAITING_ROOM"; roomId: string }
  | { type: "NAVIGATE_TO_GAME"; roomId: string }
  | { type: "NAVIGATE_TO_TITLE" };
