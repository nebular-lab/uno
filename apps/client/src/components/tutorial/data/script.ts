export type Speaker = "A" | "B";

export type MarisaFace = "normal" | "smile" | "smug";
export type ReimuFace = "normal" | "surprise" | "impressed";

export interface Dialogue {
  speaker: Speaker;
  text: string;
  audio: string;
  startFrame: number;
  durationFrames: number;
  faceA: MarisaFace;
  faceB: ReimuFace;
}

export type DemoType =
  | "title"
  | "basicRule"
  | "specialCards"
  | "forceChange"
  | "scoring"
  | "dobon"
  | "dobonReturn"
  | "otherRules"
  | "closing";

export interface Scene {
  id: string;
  durationFrames: number;
  dialogues: Dialogue[];
  demo: { type: DemoType };
}

export const FPS = 30;

/**
 * 1セリフあたりの仮フレーム数（VOICEVOX音声生成後に調整）
 * 日本語1文字あたり約0.15秒 + 余白0.5秒で概算
 */
function estimateFrames(text: string): number {
  return Math.ceil((text.length * 0.15 + 0.5) * FPS);
}

interface LineInput {
  speaker: Speaker;
  text: string;
  faceA?: MarisaFace;
  faceB?: ReimuFace;
}

function buildDialogues(lines: LineInput[], sceneId: string): Dialogue[] {
  const dialogues: Dialogue[] = [];
  let currentFrame = 0;

  for (let i = 0; i < lines.length; i++) {
    const { speaker, text, faceA = "normal", faceB = "normal" } = lines[i];
    const durationFrames = estimateFrames(text);
    dialogues.push({
      speaker,
      text,
      audio: `/tutorial/voice/${sceneId}_${String(i).padStart(2, "0")}.wav`,
      startFrame: currentFrame,
      durationFrames,
      faceA,
      faceB,
    });
    currentFrame += durationFrames;
  }

  return dialogues;
}

function totalFrames(dialogues: Dialogue[]): number {
  const last = dialogues[dialogues.length - 1];
  return last.startFrame + last.durationFrames + FPS; // 末尾に1秒余白
}

// --- シーン定義 ---

const A = "A" as const;
const B = "B" as const;

// --- シーン1: 導入 + 基本ルール ---

const introLines: LineInput[] = [
  { speaker: A, text: "ドボンUNOのルール説明をするよ" },
  { speaker: B, text: "ドボンUNO？UNOは知ってるけど" },
  { speaker: A, text: "UNOにローカルルールを足したやつ" },
  {
    speaker: A,
    text: "「ドボン」ってルールが一番の特徴だから、ドボンUNOって名前にしてる",
  },
  { speaker: B, text: "ドボンね。まあ聞いてみるわ" },
];

// --- シーン2: 基本ルール ---

const basicRuleLines: LineInput[] = [
  { speaker: A, text: "最初に7枚ずつ配られる" },
  {
    speaker: A,
    text: "場のカードと同じ色か同じ数字を出していって、先に手札なくした人の勝ち",
  },
  { speaker: B, text: "場が赤の5なら、赤か5を出す。まあここは普通だね" },
];

// --- シーン3: 記号カード（スライド表示） ---

const specialCardLines: LineInput[] = [
  {
    speaker: A,
    text: "記号カードの効果についてはこれを見てほしい",
  },
];

// --- シーン4: 強制色変えカード ---

const forceChangeLines: LineInput[] = [
  { speaker: B, text: "1つ、色がついたワイルドカードがあるね" },
  {
    speaker: A,
    text: "それは強制色変えカード。その色に変更するワイルドカードだ",
  },
  {
    speaker: B,
    text: "なるほど、例えば赤の強制色変えは、ワイルドと同じようにいつでも出せるけど、赤色が強制的に選ばれるんだね",
    faceB: "impressed",
  },
];

// --- シーン5: ローカルルール1 — 点数計算 ---

const scoringLines: LineInput[] = [
  { speaker: A, text: "ここからローカルルール。1つ目は点数計算" },
  {
    speaker: A,
    text: "誰かが上がったら、上がれなかった人は手札の合計点数を上がった人に払う",
  },
  {
    speaker: A,
    text: "数字カードはそのまま。スキップ・リバース・ドロー2が20点",
  },
  { speaker: A, text: "色変えと強制色変えが10点と30点。ドロー4は50点" },
  {
    speaker: A,
    text: "点数は設定で「カードに点数を表示」をオンにすれば見れるから、覚えなくて大丈夫",
    faceA: "smile",
  },
  {
    speaker: B,
    text: "誰かが上がりそうなとき、でかいカード抱えてると痛いな",
    faceB: "surprise",
  },
];

// --- シーン6: ローカルルール2 — ドボン ---

const dobonLines: LineInput[] = [
  { speaker: A, text: "2つ目がこのゲームの目玉、ドボン" },
  {
    speaker: A,
    text: "手札の合計点数が、場に出たカードの点数とピッタリ同じなら、ドボンで上がれる",
  },
  { speaker: B, text: "場が5で、手札が2と3なら合計5。ドボン" },
  {
    speaker: A,
    text: "そうそう。手札が5と7と8で、誰かがドロー2出したら？",
    faceA: "smug",
  },
  {
    speaker: B,
    text: "ドロー2は20点…5+7+8で20。これもドボンか",
    faceB: "impressed",
  },
  {
    speaker: A,
    text: "ドボンが決まると、出した人がドボンした人に全員の手札の合計点数を払う",
  },
  {
    speaker: B,
    text: "全員分？それは相当でかいな",
    faceB: "surprise",
  },
];

// --- シーン7: ローカルルール3 — ドボン返し ---

const dobonReturnLines: LineInput[] = [
  { speaker: A, text: "3つ目、ドボン返し" },
  {
    speaker: A,
    text: "例えば手札の合計100点でドロー4を出した。残りは50点",
  },
  {
    speaker: A,
    text: "そこにドボンされたら、ドボンした人の手札も50点。だからドボン返しできる",
    faceA: "smug",
  },
  {
    speaker: A,
    text: "ドボン返しが通ると、逆にドボンした側が全員分を払う",
  },
  {
    speaker: B,
    text: "じゃあドボン返し準備しておけば、50点のドロー4も安全に出せるわけだ",
    faceB: "impressed",
  },
  {
    speaker: B,
    text: "逆に、相手がドロー4を平気で出してきたら「ドボン返し構えてるな」って読めるね",
    faceB: "impressed",
  },
  {
    speaker: A,
    text: "そう、そこの読み合いが面白いところ",
    faceA: "smile",
  },
];

// --- シーン8: その他のローカルルール（スライド表示） ---

const otherRulesLines: LineInput[] = [
  {
    speaker: A,
    text: "他にもいくつかローカルルールがあるから、これを見てほしい",
  },
];

// --- シーン9: 締め ---

const closingLines: LineInput[] = [
  {
    speaker: B,
    text: "ドボンを警戒しつつ、自分もドボンや上がりを狙うゲームか",
    faceB: "impressed",
  },
  {
    speaker: A,
    text: "カードを出すたびにドボンされるリスクと上がりに近づくリターンの駆け引きがある",
  },
  {
    speaker: A,
    text: "ルールが不安な人は、まずはCPU相手に対戦してみてね",
    faceA: "smile",
  },
  { speaker: B, text: "やってみるわ" },
  { speaker: A, text: "じゃあやろう！", faceA: "smile" },
];

// --- シーン組み立て ---

function createScene(
  id: string,
  lines: LineInput[],
  demoType: DemoType,
): Scene {
  const dialogues = buildDialogues(lines, id);
  return {
    id,
    durationFrames: totalFrames(dialogues),
    dialogues,
    demo: { type: demoType },
  };
}

export const scenes: Scene[] = [
  createScene("intro", introLines, "title"),
  createScene("basic", basicRuleLines, "basicRule"),
  createScene("special", specialCardLines, "specialCards"),
  createScene("force-change", forceChangeLines, "forceChange"),
  createScene("scoring", scoringLines, "scoring"),
  createScene("dobon", dobonLines, "dobon"),
  createScene("dobon-return", dobonReturnLines, "dobonReturn"),
  createScene("other-rules", otherRulesLines, "otherRules"),
  createScene("closing", closingLines, "closing"),
];

export const totalDurationFrames = scenes.reduce(
  (sum, scene) => sum + scene.durationFrames,
  0,
);
