import { motion } from "motion/react";

type Props = {
  direction: number; // 1=時計回り, -1=反時計回り
};

// 半円パスを生成（矢印を含む）
const createSemiCirclePath = (isClockwise: boolean): string => {
  // 完全な半円（rx = ry）
  const r = 80;
  // 矢印のサイズ
  const arrowSize = 20;
  const arrowAngle = -30; // 矢印の折れ曲がり角度（度）- マイナスで鋭角に

  if (isClockwise) {
    // 時計回り: 下から上へ弧を描き、折れ曲がりで終わる（左に膨らむ）
    const ax = arrowSize * Math.sin((arrowAngle * Math.PI) / 180);
    const ay = arrowSize * Math.cos((arrowAngle * Math.PI) / 180);
    // 弧を描いてから折れ曲がり部分へ
    return `M 0,${r} A ${r},${r} 0 0 1 0,${-r} L ${ax},${-r + ay}`;
  }
  // 反時計回り: 上から下へ弧を描き、折れ曲がりで終わる（左に膨らむ）
  const ax = arrowSize * Math.sin((arrowAngle * Math.PI) / 180);
  const ay = arrowSize * Math.cos((arrowAngle * Math.PI) / 180);
  return `M 0,${-r} A ${r},${r} 0 0 1 0,${r} L ${ax},${r - ay}`;
};

export const TurnDirectionIndicator = ({ direction }: Props) => {
  const isClockwise = direction === 1;

  // 左右とも同じパスを使い、右側は180度回転で点対称にする
  const path = createSemiCirclePath(isClockwise);

  // テーブルサイズ: 900x360
  return (
    <div className="pointer-events-none relative h-[360px] w-[900px]">
      {/* 左側の半円矢印 */}
      <svg
        aria-label={isClockwise ? "時計回り（左）" : "反時計回り（左）"}
        className="absolute left-[125px] top-1/2 -translate-y-1/2"
        height="200"
        role="img"
        style={{ overflow: "visible" }}
        viewBox="-100 -100 200 200"
        width="200"
      >
        <motion.path
          animate={{ pathLength: 1, opacity: 1 }}
          d={path}
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          key={`left-${direction}`}
          stroke="rgba(251, 191, 36, 0.7)"
          strokeLinecap="butt"
          strokeLinejoin="round"
          strokeWidth="3"
          transition={{
            pathLength: {
              duration: 2.0,
              ease: "easeInOut",
              repeat: Number.POSITIVE_INFINITY,
              repeatDelay: 0.5,
            },
            opacity: {
              duration: 0.01,
              repeat: Number.POSITIVE_INFINITY,
              repeatDelay: 2.49,
            },
          }}
        />
      </svg>

      {/* 右側の半円矢印（左側を180度回転して点対称に配置） */}
      <svg
        aria-label={isClockwise ? "時計回り（右）" : "反時計回り（右）"}
        className="absolute right-[125px] top-1/2 -translate-y-1/2 rotate-180"
        height="200"
        role="img"
        style={{ overflow: "visible" }}
        viewBox="-100 -100 200 200"
        width="200"
      >
        <motion.path
          animate={{ pathLength: 1, opacity: 1 }}
          d={path}
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          key={`right-${direction}`}
          stroke="rgba(251, 191, 36, 0.7)"
          strokeLinecap="butt"
          strokeLinejoin="round"
          strokeWidth="3"
          transition={{
            pathLength: {
              duration: 2.0,
              ease: "easeInOut",
              repeat: Number.POSITIVE_INFINITY,
              repeatDelay: 0.5,
            },
            opacity: {
              duration: 0.01,
              repeat: Number.POSITIVE_INFINITY,
              repeatDelay: 2.49,
            },
          }}
        />
      </svg>
    </div>
  );
};
