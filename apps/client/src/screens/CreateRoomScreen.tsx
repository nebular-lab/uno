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
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-foreground relative overflow-hidden">
      {/* 背景の装飾カード */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-10 left-10 w-24 h-36 bg-white rounded-lg rotate-[-15deg]" />
        <div className="absolute top-20 right-20 w-24 h-36 bg-white rounded-lg rotate-[20deg]" />
        <div className="absolute bottom-20 left-1/4 w-24 h-36 bg-white rounded-lg rotate-[10deg]" />
        <div className="absolute bottom-10 right-1/3 w-24 h-36 bg-white rounded-lg rotate-[-10deg]" />
      </div>

      {/* ヘッダー */}
      <div className="p-4 border-b border-slate-700 relative z-10">
        <h1 className="text-2xl font-bold text-white">ルーム作成</h1>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative z-10">
        {/* エラー表示 */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 text-red-300 rounded-lg border border-red-700 w-full max-w-md">
            {error}
          </div>
        )}

        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-sm w-full max-w-md mb-8">
          <p className="text-slate-300 text-center">
            新しいルームを作成して、他のプレイヤーを待ちます。
          </p>
        </div>

        {/* ボタン */}
        <div className="flex gap-4 w-full max-w-md">
          <Button
            className="flex-1 text-lg h-20 bg-slate-700 hover:bg-slate-600 border-0 font-medium transition-all text-slate-300"
            disabled={isLoading}
            onClick={navigateToLobby}
          >
            キャンセル
          </Button>
          <Button
            className="flex-1 text-lg h-20 bg-blue-600 hover:bg-blue-500 border-0 font-bold shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 text-white"
            disabled={isLoading}
            onClick={handleCreate}
          >
            {isLoading ? "作成中..." : "作成"}
          </Button>
        </div>
      </div>
    </div>
  );
}
