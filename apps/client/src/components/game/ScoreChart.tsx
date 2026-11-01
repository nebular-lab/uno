import type { ClientGameResult, ClientPlayer } from "@/types/connection";

type Props = {
  gameHistory: ClientGameResult[];
  players: ClientPlayer[];
};

// プレイヤーごとの線の色（暗い背景で見分けやすいもの）
const LINE_COLORS = [
  "#38bdf8", // sky-400
  "#fbbf24", // amber-400
  "#34d399", // emerald-400
  "#fb7185", // rose-400
  "#a78bfa", // violet-400
  "#fb923c", // orange-400
];

const WIDTH = 720;
const HEIGHT = 300;
const PADDING = { top: 12, right: 16, bottom: 28, left: 44 };

// 目盛りの間隔を 1, 2, 5 × 10^n に丸める
const niceStep = (range: number, targetTicks: number): number => {
  const raw = range / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
};

export const ScoreChart = ({ gameHistory, players }: Props) => {
  // 各プレイヤーの累計スコア推移（先頭は開始時点の0）
  const series = players.map((player) => {
    let total = 0;
    const values = [0];
    for (const result of gameHistory) {
      total += result.scoreChanges[player.sessionId] ?? 0;
      values.push(total);
    }
    return { player, values };
  });

  const allValues = series.flatMap((s) => s.values);
  const rawMin = Math.min(0, ...allValues);
  const rawMax = Math.max(0, ...allValues);
  const step = niceStep(Math.max(rawMax - rawMin, 1), 4);
  const yMin = Math.floor(rawMin / step) * step;
  const yMax = Math.ceil(rawMax / step) * step || step;

  const ticks: number[] = [];
  for (let v = yMin; v <= yMax; v += step) ticks.push(v);

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const gameCount = gameHistory.length;

  const toX = (index: number) =>
    PADDING.left + (gameCount === 0 ? 0 : (index / gameCount) * plotWidth);
  const toY = (value: number) =>
    PADDING.top + ((yMax - value) / (yMax - yMin)) * plotHeight;

  // X軸ラベルは多すぎないよう間引く
  const xLabelInterval = Math.max(1, Math.ceil(gameCount / 12));
  const showDots = gameCount <= 30;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <svg
        aria-label="累計スコアの推移"
        className="min-h-0 w-full flex-1"
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        {/* 横グリッドとY軸ラベル */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              stroke={tick === 0 ? "#64748b" : "#334155"}
              strokeWidth={1}
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={toY(tick)}
              y2={toY(tick)}
            />
            <text
              className="fill-slate-400 font-mono"
              dominantBaseline="middle"
              fontSize={12}
              textAnchor="end"
              x={PADDING.left - 8}
              y={toY(tick)}
            >
              {tick > 0 ? `+${tick}` : tick}
            </text>
          </g>
        ))}

        {/* X軸ラベル（ゲーム番号） */}
        {gameHistory.map((result, i) =>
          (i + 1) % xLabelInterval === 0 || i === gameCount - 1 ? (
            <text
              className="fill-slate-400"
              fontSize={12}
              key={result.gameNumber}
              textAnchor="middle"
              x={toX(i + 1)}
              y={HEIGHT - 8}
            >
              #{result.gameNumber}
            </text>
          ) : null,
        )}

        {/* 折れ線 */}
        {series.map(({ player, values }, i) => {
          const color = LINE_COLORS[i % LINE_COLORS.length];
          const points = values.map((v, j) => `${toX(j)},${toY(v)}`).join(" ");
          return (
            <g key={player.sessionId}>
              <polyline
                fill="none"
                points={points}
                stroke={color}
                strokeLinejoin="round"
                strokeWidth={2.5}
              />
              {showDots &&
                values.map((v, j) => (
                  <circle
                    cx={toX(j)}
                    cy={toY(v)}
                    fill={color}
                    key={j}
                    r={3.5}
                  />
                ))}
            </g>
          );
        })}
      </svg>

      {/* 凡例 */}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm">
        {series.map(({ player, values }, i) => {
          const total = values[values.length - 1];
          return (
            <div className="flex items-center gap-2" key={player.sessionId}>
              <span
                className="inline-block h-[3px] w-4 rounded-full"
                style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }}
              />
              <span className="text-slate-300">{player.name}</span>
              <span className="font-mono text-slate-400">
                {total > 0 ? `+${total}` : total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
