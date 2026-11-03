import { useAtomValue } from "jotai";
import { singlePlayRecordsAtom } from "../atoms/singlePlayRecordAtom";
import { cn } from "../lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

// 収支の符号付き表示
const formatScore = (score: number) => (score > 0 ? `+${score}` : `${score}`);

// 収支の色
const scoreColorClass = (score: number) =>
  cn(
    score > 0 && "text-green-400",
    score < 0 && "text-red-400",
    score === 0 && "text-slate-400",
  );

// 累計収支の推移グラフのサイズ
const CHART_WIDTH = 1100;
const CHART_HEIGHT = 320;
const CHART_PADDING = { top: 16, right: 16, bottom: 16, left: 48 };

/**
 * 累計収支の推移グラフ（0ゲーム目の0から始まる折れ線）
 */
const BalanceChart = ({ balances }: { balances: number[] }) => {
  const values = [0, ...balances];
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const range = max - min;

  const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const x = (i: number) =>
    CHART_PADDING.left + (plotWidth * i) / Math.max(values.length - 1, 1);
  // 全て同じ値（収支がずっと0など）のときは中央に描く
  const y = (v: number) =>
    max === min
      ? CHART_PADDING.top + plotHeight / 2
      : CHART_PADDING.top + (plotHeight * (max - v)) / range;

  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = values[values.length - 1];

  return (
    <svg
      aria-label="累計収支の推移"
      className="h-full w-full"
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
    >
      {/* 0の基準線 */}
      <line
        className="stroke-slate-600"
        strokeDasharray="4 4"
        x1={CHART_PADDING.left}
        x2={CHART_WIDTH - CHART_PADDING.right}
        y1={y(0)}
        y2={y(0)}
      />
      {/* 軸ラベル（最大・0・最小） */}
      {[max, 0, min]
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .map((v) => (
          <text
            className="fill-slate-400 font-mono text-[12px]"
            dominantBaseline="middle"
            key={v}
            textAnchor="end"
            x={CHART_PADDING.left - 8}
            y={y(v)}
          >
            {formatScore(v)}
          </text>
        ))}
      <polyline
        className="fill-none stroke-sky-400"
        points={points}
        strokeLinejoin="round"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      {/* 最新の累計 */}
      <circle
        className={last >= 0 ? "fill-green-400" : "fill-red-400"}
        cx={x(values.length - 1)}
        cy={y(last)}
        r={4}
      />
    </svg>
  );
};

const SummaryItem = ({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) => (
  <div className="flex-1 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
    <div className="text-xs text-slate-400">{label}</div>
    <div className={cn("font-mono text-2xl font-bold text-white", className)}>
      {value}
    </div>
  </div>
);

/**
 * シングルプレイの成績（通算収支・平均収支・対戦数・累計収支の推移）
 */
const SinglePlayRecordView = () => {
  const records = useAtomValue(singlePlayRecordsAtom);

  // 各ゲーム終了時点の累計収支
  const balances: number[] = [];
  for (const record of records) {
    balances.push((balances[balances.length - 1] ?? 0) + record.scoreChange);
  }
  const total = balances[balances.length - 1] ?? 0;
  // 1ゲームあたりの平均収支（小数第1位まで）
  const average =
    records.length > 0 ? Math.round((total / records.length) * 10) / 10 : 0;

  if (records.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-400">
        まだ成績がありません。シングルプレイで対戦すると、ここに収支が記録されます。
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex gap-3">
        <SummaryItem
          className={scoreColorClass(total)}
          label="通算収支"
          value={formatScore(total)}
        />
        <SummaryItem
          className={scoreColorClass(average)}
          label="平均収支"
          value={formatScore(average)}
        />
        <SummaryItem label="対戦数" value={`${records.length}`} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-700 bg-slate-800/50 p-3">
        <div className="mb-1 text-xs text-slate-400">累計収支の推移</div>
        <div className="min-h-0 flex-1">
          <BalanceChart balances={balances} />
        </div>
      </div>
    </div>
  );
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * シングルプレイの成績ダイアログ
 * タイトル画面とシングルプレイ中の収支ボタンで同じものを開く
 */
export const SinglePlayRecordDialog = ({ open, onOpenChange }: Props) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent
      className="flex w-[90%] max-w-[1100px] flex-col overflow-hidden p-6"
      style={{ height: "520px" }}
    >
      <DialogHeader>
        <DialogTitle className="text-xl font-bold text-white">
          シングルプレイ成績
        </DialogTitle>
      </DialogHeader>
      <SinglePlayRecordView />
    </DialogContent>
  </Dialog>
);
