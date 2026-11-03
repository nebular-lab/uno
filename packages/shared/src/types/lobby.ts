// ルームの状態（ロビー表示用）
// 一度ゲームを開始したルームは、ゲームの合間（waiting）も含めて "playing" のまま
export type RoomStatus = "waiting" | "playing";

// ルームのメタデータ（サーバー・クライアント共通）
export interface RoomMetadata {
  ownerName?: string;
  status?: RoomStatus;
  playerNames?: string[]; // 参加プレイヤー名（席順、CPUを含む）
  spectatorCount?: number;
}

// ルーム作成オプション
export interface CreateRoomOptions {
  playerName: string;
}

// ルーム参加オプション
export interface JoinRoomOptions {
  playerName: string;
  spectate?: boolean; // 観戦者として参加する
}
