import { SlideCard } from "./SlideCard";

interface CardInfo {
  color: string;
  value: string;
  label: string;
  description: string;
}

const CARDS: CardInfo[] = [
  {
    color: "red",
    value: "skip",
    label: "スキップ",
    description: "次の人の手番を飛ばす",
  },
  {
    color: "blue",
    value: "reverse",
    label: "リバース",
    description: "順番を逆回りにする",
  },
  {
    color: "green",
    value: "draw2",
    label: "ドロー2",
    description: "次の人に2枚引かせる",
  },
  {
    color: "gray",
    value: "draw4",
    label: "ドロー4",
    description: "次の人に4枚引かせる\n好きな色を指定できる",
  },
  {
    color: "gray",
    value: "wild",
    label: "ワイルド",
    description: "いつでも出せる\n好きな色を指定できる",
  },
  {
    color: "red",
    value: "force-change",
    label: "強制色変え",
    description: "いつでも出せる\n色はカードの色で固定",
  },
];

function CardRow({ card }: { card: CardInfo }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <SlideCard color={card.color} size="small" value={card.value} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ color: "#fff", fontSize: 15, fontWeight: "bold" }}>
          {card.label}
        </span>
        <span
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: 13,
            lineHeight: 1.3,
            whiteSpace: "pre-line",
          }}
        >
          {card.description}
        </span>
      </div>
    </div>
  );
}

export function SpecialCardsSlide() {
  const leftColumn = CARDS.slice(0, 3);
  const rightColumn = CARDS.slice(3, 6);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        gap: 48,
        padding: "0 60px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {leftColumn.map((card) => (
          <CardRow card={card} key={card.value} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {rightColumn.map((card) => (
          <CardRow card={card} key={card.value} />
        ))}
      </div>
    </div>
  );
}
