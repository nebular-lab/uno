type Props = {
  direction: number; // 1=時計回り, -1=反時計回り
};

// 半円の半径
const RADIUS = 80;
// 点が半円を一周する時間（秒）
const DURATION = 3.6;

const TRACK_COLOR = "rgba(251, 191, 36, 0.18)";
const DOT_COLOR = "rgba(251, 191, 36, 0.75)";

// 左に膨らむ半円パス（時計回りは下→上、反時計回りは上→下）
const createSemiCirclePath = (isClockwise: boolean): string =>
  isClockwise
    ? `M 0,${RADIUS} A ${RADIUS},${RADIUS} 0 0 1 0,${-RADIUS}`
    : `M 0,${-RADIUS} A ${RADIUS},${RADIUS} 0 0 0 0,${RADIUS}`;

const SemiCircle = ({
  isClockwise,
  className,
  label,
}: {
  isClockwise: boolean;
  className: string;
  label: string;
}) => {
  // 点は始点に置き、円の中心を軸に180度回転させて半円をなぞる
  const startY = isClockwise ? RADIUS : -RADIUS;
  const endAngle = isClockwise ? 180 : -180;

  return (
    <svg
      aria-label={label}
      className={className}
      height="200"
      role="img"
      style={{ overflow: "visible" }}
      viewBox="-100 -100 200 200"
      width="200"
    >
      <path
        d={createSemiCirclePath(isClockwise)}
        fill="none"
        stroke={TRACK_COLOR}
        strokeLinecap="round"
        strokeWidth="2"
      />
      <circle cx="0" cy={startY} fill={DOT_COLOR} opacity="0" r="4">
        <animateTransform
          attributeName="transform"
          calcMode="spline"
          dur={`${DURATION}s`}
          from="0 0 0"
          keySplines="0.45 0 0.55 1"
          keyTimes="0;1"
          repeatCount="indefinite"
          to={`${endAngle} 0 0`}
          type="rotate"
        />
        {/* 両端ではふわっと現れて消える */}
        <animate
          attributeName="opacity"
          dur={`${DURATION}s`}
          keyTimes="0;0.15;0.85;1"
          repeatCount="indefinite"
          values="0;1;1;0"
        />
      </circle>
    </svg>
  );
};

export const TurnDirectionIndicator = ({ direction }: Props) => {
  const isClockwise = direction === 1;

  // テーブルサイズ: 900x360
  // 右側は左側を180度回転して点対称に配置する
  return (
    <div className="pointer-events-none relative h-[360px] w-[900px]">
      <SemiCircle
        className="absolute left-[125px] top-1/2 -translate-y-1/2"
        isClockwise={isClockwise}
        key={`left-${direction}`}
        label={isClockwise ? "時計回り（左）" : "反時計回り（左）"}
      />
      <SemiCircle
        className="absolute right-[125px] top-1/2 -translate-y-1/2 rotate-180"
        isClockwise={isClockwise}
        key={`right-${direction}`}
        label={isClockwise ? "時計回り（右）" : "反時計回り（右）"}
      />
    </div>
  );
};
