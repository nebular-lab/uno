export function RoomCardSkeleton() {
  return (
    <div className="flex flex-col p-4 rounded-xl bg-slate-800/50 border border-slate-700 shadow-lg backdrop-blur-sm animate-pulse">
      {/* オーナー名のスケルトン */}
      <div className="h-7 bg-slate-700 rounded w-24 mb-2" />
      {/* プレイヤー数のスケルトン */}
      <div className="flex items-center gap-1 mb-4">
        <div className="w-4 h-4 bg-slate-700 rounded" />
        <div className="h-4 bg-slate-700 rounded w-12" />
      </div>
      {/* ボタンのスケルトン */}
      <div className="w-full h-20 bg-slate-700 rounded-md" />
    </div>
  );
}
