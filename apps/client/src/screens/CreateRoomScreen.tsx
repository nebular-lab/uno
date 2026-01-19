import { useAtomValue, useSetAtom } from "jotai";
import { Button } from "@/components/ui/button";
import { navigateToLobbyAtom } from "../atoms/appAtoms";
import { createRoomAtom, gameStateAtom } from "../atoms/connectionAtoms";

export function CreateRoomScreen() {
  const gameState = useAtomValue(gameStateAtom);
  const createRoom = useSetAtom(createRoomAtom);
  const navigateToLobby = useSetAtom(navigateToLobbyAtom);

  const isLoading = gameState.status === "joining";
  const error = gameState.status === "error" ? gameState.error : null;

  const handleCreate = () => {
    createRoom();
  };

  return (
    <div className="h-full flex flex-col bg-card text-foreground">
      {/* ヘッダー */}
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold">ルーム作成</h1>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-auto p-4">
        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}

        <p className="text-muted-foreground">
          新しいルームを作成して、他のプレイヤーを待ちます。
        </p>
      </div>

      {/* フッター */}
      <div className="p-4 border-t space-y-3">
        <Button
          className="w-full text-lg py-6"
          disabled={isLoading}
          onClick={handleCreate}
          variant="outline"
        >
          {isLoading ? "作成中..." : "作成"}
        </Button>
        <Button
          className="w-full text-lg py-6"
          disabled={isLoading}
          onClick={navigateToLobby}
          variant="ghost"
        >
          キャンセル
        </Button>
      </div>
    </div>
  );
}
