import { cn } from "@/lib/utils";

export type Player = {
  seatIndex: number;
  name: string;
  cardCount: number;
  isHost?: boolean;
  isReady?: boolean;
};

type Props = {
  player: Player;
  isCurrentPlayer?: boolean;
  displayIndex?: number; // 表示位置（回転後の位置）
};

// 6人の位置定義（0:上中央 → 時計回り）
// 横長画面: 1250 x 592 を想定、下にカード配置スペースを確保するため上寄せ
// すべて中央基準（-translate-x-1/2）で配置
const seatPositions = [
  "top-6 left-1/2 -translate-x-1/2", // 0: 上中央
  "top-30 left-[85%] -translate-x-1/2", // 1: 右上
  "top-70 left-[85%] -translate-x-1/2", // 2: 右下
  "top-92 left-1/2 -translate-x-1/2", // 3: 下中央
  "top-70 left-[15%] -translate-x-1/2", // 4: 左下
  "top-30 left-[15%] -translate-x-1/2", // 5: 左上
];

// アバター位置（名前プレートの左右どちらにつけるか）
const avatarPositions = [
  "-left-1 -top-1 absolute z-30",
  "-left-1 -top-1 absolute z-30",
  "-left-1 -top-1 absolute z-30",
  "-left-1 -top-1 absolute z-30",
  "-right-1 -top-1 absolute z-30",
  "-right-1 -top-1 absolute z-30",
];

// 名前プレートのjustify方向
const namePositions = [
  "justify-end",
  "justify-end",
  "justify-end",
  "justify-end",
  "justify-start",
  "justify-start",
];

// 空席バッジ
const EmptyBadge = ({ size = 70 }: { size?: number }) => {
  return (
    <div
      className="flex items-center justify-center rounded-full border-2 border-dashed border-slate-600 text-slate-500 text-xs font-medium"
      style={{ width: size, height: size }}
    >
      Empty
    </div>
  );
};

// 空席表示
export const EmptySeat = ({
  seatIndex,
  displayIndex,
}: {
  seatIndex: number;
  displayIndex?: number; // 表示位置（回転後の位置）
}) => {
  const posIndex = displayIndex ?? seatIndex;
  const seatPos = seatPositions[posIndex] ?? seatPositions[0];

  return (
    <div className={cn("absolute size-fit", seatPos)}>
      <EmptyBadge size={70} />
    </div>
  );
};

// プレイヤーステータスバッジ（Ready/Wait + HOST表示）
const PlayerStatusBadge = ({
  isReady,
  isHost,
  size = 70,
}: {
  isReady?: boolean;
  isHost?: boolean;
  size?: number;
}) => {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Ready/Wait 丸 */}
      <div
        className={cn(
          "flex items-center justify-center rounded-full text-white text-xs font-medium",
          isReady ? "bg-green-600" : "bg-avatar-fallback-background",
        )}
        style={{ width: size, height: size }}
      >
        {isReady ? "Ready" : "Waiting"}
      </div>
      {/* HOSTバッジ（上に重ねて表示） */}
      {isHost && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-black shadow">
          HOST
        </div>
      )}
    </div>
  );
};

// プレイヤー名プレート
const PlayerNamePlate = ({
  name,
  namePos,
  isCurrentPlayer,
}: {
  name: string;
  namePos: string;
  isCurrentPlayer?: boolean;
}) => {
  return (
    <div
      className={cn(
        namePos,
        "relative z-10 flex h-[60px] w-[180px] items-center gap-2 rounded-full border bg-player-nameplate-background shadow-lg transition-colors",
        isCurrentPlayer && "border-yellow-400",
      )}
    >
      <div className="flex w-[130px] flex-col items-center justify-center">
        <span className="truncate text-player-nameplate-foreground text-sm">
          {name}
        </span>
      </div>
    </div>
  );
};

export const PlayerSeat = ({
  player,
  isCurrentPlayer,
  displayIndex,
}: Props) => {
  const posIndex = displayIndex ?? player.seatIndex;
  const seatPos = seatPositions[posIndex] ?? seatPositions[0];
  const avatarPos = avatarPositions[posIndex] ?? avatarPositions[0];
  const namePos = namePositions[posIndex] ?? namePositions[0];

  return (
    <div className={cn("absolute size-fit", seatPos)}>
      <PlayerNamePlate
        isCurrentPlayer={isCurrentPlayer}
        name={player.name}
        namePos={namePos}
      />
      <div className={cn(avatarPos)}>
        <PlayerStatusBadge
          isHost={player.isHost}
          isReady={player.isReady}
          size={70}
        />
      </div>
    </div>
  );
};
