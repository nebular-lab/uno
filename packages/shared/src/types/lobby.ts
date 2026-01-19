// ルームのメタデータ（サーバー・クライアント共通）
export interface RoomMetadata {
  ownerName?: string;
}

// ルーム作成オプション
export interface CreateRoomOptions {
  playerName: string;
}

// ルーム参加オプション
export interface JoinRoomOptions {
  playerName: string;
}
