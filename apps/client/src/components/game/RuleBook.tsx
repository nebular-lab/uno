import { useState } from "react";
import { cn } from "@/lib/utils";

// --- カード表示コンポーネント ---

const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> =
  {
    red: { bg: "#ef4444", border: "#dc2626", text: "#fff" },
    blue: { bg: "#3b82f6", border: "#2563eb", text: "#fff" },
    green: { bg: "#16a34a", border: "#15803d", text: "#fff" },
    yellow: { bg: "#facc15", border: "#eab308", text: "#000" },
    gray: { bg: "#6b7280", border: "#4b5563", text: "#fff" },
  };

const VALUE_DISPLAY: Record<string, string> = {
  skip: "\u29B8",
  reverse: "\u21C4",
  draw2: "+2",
  draw4: "+4",
  wild: "W",
  "force-change": "W",
};

function MiniCard({ color, value }: { color: string; value: string }) {
  const colors = COLOR_MAP[color] ?? COLOR_MAP.gray;
  const display = VALUE_DISPLAY[value] ?? value;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-md border-2 font-bold shadow"
      style={{
        width: 36,
        height: 50,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        color: colors.text,
        fontSize: 16,
      }}
    >
      {display}
    </div>
  );
}

// --- 各ページ ---

function BasicRulePage() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-300">
        場のカードと同じ<span className="font-bold text-white">色</span>か
        <span className="font-bold text-white">数字</span>
        のカードを出して、手札を0枚にすると上がり。
      </p>
      <h4 className="text-sm font-bold text-white">記号カード</h4>
      <div className="grid grid-cols-2 gap-2">
        {[
          {
            color: "red",
            value: "skip",
            name: "スキップ",
            desc: "次の人を飛ばす",
          },
          {
            color: "blue",
            value: "reverse",
            name: "リバース",
            desc: "順番を逆にする",
          },
          {
            color: "green",
            value: "draw2",
            name: "ドロー2",
            desc: "次の人に2枚引かせる",
          },
          {
            color: "gray",
            value: "draw4",
            name: "ドロー4",
            desc: "次の人に4枚引かせる\n好きな色を指定",
          },
          {
            color: "gray",
            value: "wild",
            name: "色変え",
            desc: "いつでも出せる\n好きな色を指定",
          },
          {
            color: "red",
            value: "force-change",
            name: "固定色変え",
            desc: "いつでも出せる\n色はカードの色で固定",
          },
        ].map((card) => (
          <div className="flex items-center gap-2" key={card.value}>
            <MiniCard color={card.color} value={card.value} />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white">{card.name}</span>
              <span className="whitespace-pre-line text-xs text-slate-400">
                {card.desc}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoringPage() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-300">
        誰かが上がったらそのゲームは終了。
        <span className="font-bold text-white">
          上がれなかった人は手札の合計点数を上がった人に支払う。
        </span>
      </p>
      <h4 className="text-sm font-bold text-white">カードの点数</h4>
      <div className="grid grid-cols-2 gap-2">
        {[
          { color: "blue", value: "5", name: "数字カード", points: "その数字" },
          { color: "red", value: "skip", name: "スキップ", points: "20点" },
          {
            color: "green",
            value: "reverse",
            name: "リバース",
            points: "20点",
          },
          { color: "yellow", value: "draw2", name: "ドロー2", points: "20点" },
          {
            color: "red",
            value: "force-change",
            name: "固定色変え",
            points: "10点",
          },
          { color: "gray", value: "wild", name: "色変え", points: "30点" },
          { color: "gray", value: "draw4", name: "ドロー4", points: "50点" },
        ].map((card) => (
          <div className="flex items-center gap-2" key={card.value}>
            <MiniCard color={card.color} value={card.value} />
            <span className="text-xs text-white">{card.name}</span>
            <span className="text-xs font-bold text-yellow-400">
              {card.points}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DobonPage() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-300">
        他のプレイヤーが出したカードの点数と、
        <span className="font-bold text-white">
          自分の手札の合計点数が一致したとき
        </span>
        にドボンできる。
      </p>
      <div className="flex items-center justify-center gap-3 rounded-lg bg-slate-800/50 p-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-slate-400">
            他のプレイヤーが出したカード
          </span>
          <MiniCard color="red" value="skip" />
          <span className="text-xs font-bold text-yellow-400">20点</span>
        </div>
        <span className="text-lg font-bold text-white">=</span>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-slate-400">自分の手札の合計</span>
          <div className="flex gap-1">
            <MiniCard color="blue" value="5" />
            <MiniCard color="green" value="7" />
            <MiniCard color="red" value="8" />
          </div>
          <span className="text-xs font-bold text-yellow-400">
            5+7+8 = 20点
          </span>
        </div>
      </div>
      <p className="text-sm text-slate-300">
        ドボンすると、
        <span className="font-bold text-white">
          ドボンされた人が全員の手札の合計点数をドボンした人に支払う。
        </span>
      </p>
    </div>
  );
}

function DobonReturnPage() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-300">
        自分がドボンされたとき、
        <span className="font-bold text-white">
          残りの手札の合計点数がドボンされた点数と一致
        </span>
        していれば、ドボン返しができる。
      </p>
      <div className="flex items-center justify-center gap-3 rounded-lg bg-slate-800/50 p-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-slate-400">
            自分が出してドボンされたカード
          </span>
          <MiniCard color="gray" value="draw4" />
          <span className="text-xs font-bold text-yellow-400">50点</span>
        </div>
        <span className="text-lg font-bold text-white">=</span>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-slate-400">自分の残りの手札</span>
          <div className="flex gap-1">
            <MiniCard color="red" value="skip" />
            <MiniCard color="gray" value="wild" />
          </div>
          <span className="text-xs font-bold text-yellow-400">
            20+30 = 50点
          </span>
        </div>
      </div>
      <p className="text-sm text-slate-300">
        ドボン返しすると、
        <span className="font-bold text-white">
          ドボンした人が全員の手札の合計点数をドボン返しした人に支払う。
        </span>
      </p>
    </div>
  );
}

function OtherRulesPage() {
  const rules: {
    name: string;
    desc: string;
    visual: React.ReactNode;
  }[] = [
    {
      name: "スタッキング",
      desc: "+2に+2か+4、+4に+4を重ねられる。ドロー数は累積する。",
      visual: (
        <div className="flex items-center gap-1">
          <MiniCard color="red" value="draw2" />
          <span className="text-sm font-bold text-yellow-400">→</span>
          <MiniCard color="blue" value="draw2" />
        </div>
      ),
    },
    {
      name: "重ね出し",
      desc: "同じカードを複数持っていたら、まとめて出せる。",
      visual: (
        <div className="flex gap-1">
          <MiniCard color="red" value="5" />
          <MiniCard color="red" value="5" />
        </div>
      ),
    },
    {
      name: "カットイン",
      desc: "場と同じカード（同色・同値）なら、自分の番でなくても出せる。",
      visual: (
        <div className="flex items-center gap-1">
          <MiniCard color="blue" value="3" />
          <span className="text-sm font-bold text-yellow-400">→</span>
          <MiniCard color="blue" value="3" />
        </div>
      ),
    },
    {
      name: "記号上がり禁止",
      desc: "最後の1枚が記号カードの場合は出せない。",
      visual: (
        <div className="flex items-center gap-1">
          <MiniCard color="red" value="skip" />
          <span className="text-sm font-bold text-red-400">✕</span>
        </div>
      ),
    },
    {
      name: "任意ドロー",
      desc: "出せるカードがあっても、山札から1枚引くことができる。",
      visual: (
        <div
          className="flex shrink-0 items-center justify-center rounded-md border-2 font-bold shadow"
          style={{
            width: 36,
            height: 50,
            backgroundColor: "#374151",
            borderColor: "#4b5563",
            color: "#9ca3af",
            fontSize: 16,
          }}
        >
          ?
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {rules.map((rule) => (
        <div
          className="flex items-center gap-3 rounded-lg bg-slate-800/50 px-3 py-2"
          key={rule.name}
        >
          <div className="flex w-[80px] shrink-0 justify-center">
            {rule.visual}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">{rule.name}</span>
            <p className="text-xs text-slate-400">{rule.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- タブ定義 ---

const TABS = [
  { id: "basic", label: "基本ルール", content: <BasicRulePage /> },
  { id: "scoring", label: "点数計算", content: <ScoringPage /> },
  { id: "dobon", label: "ドボン", content: <DobonPage /> },
  { id: "return", label: "ドボン返し", content: <DobonReturnPage /> },
  { id: "other", label: "その他", content: <OtherRulesPage /> },
] as const;

// --- メインコンポーネント ---

export function RuleBook() {
  const [activeTab, setActiveTab] = useState("basic");
  const currentTab = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <div className="flex h-full flex-col">
      {/* タブ */}
      <div className="flex border-b border-slate-700">
        {TABS.map((tab) => (
          <button
            className={cn(
              "flex-1 py-2 text-xs font-bold transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-blue-400 text-blue-400"
                : "text-slate-500 hover:text-slate-300",
            )}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto p-4">{currentTab.content}</div>
    </div>
  );
}
