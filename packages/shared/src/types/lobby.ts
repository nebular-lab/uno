// LobbyRoomから受け取るルーム情報
export interface RoomListingData {
  roomId: string;
  name: string;
  clients: number;
  maxClients: number;
  metadata?: {
    ownerName?: string;
  };
}

// ルーム作成オプション
export interface CreateRoomOptions {
  playerName: string;
}

// ルーム参加オプション
export interface JoinRoomOptions {
  playerName: string;
}
