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
  | "forceChangeCards"
  | "scoringSlide"
  | "scoringPlay"
  | "dobonPlay"
  | "dobonReturnPlay"
  | "otherRules"
  | "closing";

export interface Scene {
  id: string;
  durationFrames: number;
  dialogues: Dialogue[];
  demo: { type: DemoType };
  sectionTitle?: string;
  showSectionIntro?: boolean;
}

export const FPS = 30;

/**
 * 音声ファイルの実測フレーム数（scripts/get-voice-durations.sh で生成）
 * 実測値がない場合はテキスト長から概算する
 */
const VOICE_DURATIONS: Record<string, number> = {
  "marisa_basic_1.mp3": 82,
  "marisa_basic_2.mp3": 199,
  "marisa_closing_1.mp3": 125,
  "marisa_closing_2.mp3": 108,
  "marisa_dobon_1.mp3": 101,
  "marisa_dobon_2.mp3": 240,
  "marisa_dobon_3.mp3": 227,
  "marisa_force_1.mp3": 268,
  "marisa_intro_1.mp3": 127,
  "marisa_intro_2.mp3": 196,
  "marisa_intro_3.mp3": 181,
  "marisa_intro_4.mp3": 125,
  "marisa_other_1.mp3": 132,
  "marisa_other_2.mp3": 186,
  "marisa_return_1.mp3": 67,
  "marisa_return_2.mp3": 91,
  "marisa_return_3.mp3": 196,
  "marisa_return_4.mp3": 255,
  "marisa_return_5.mp3": 272,
  "marisa_return_6.mp3": 65,
  "marisa_scoring_3.mp3": 123,
  "marisa_scoring_4.mp3": 97,
  "marisa_scoring_5.mp3": 281,
  "marisa_scoring_6.mp3": 250,
  "marisa_scoring_play_1.mp3": 67,
  "marisa_special_1.mp3": 108,
  "marisa_special_2.mp3": 108,
  "reimu_basic_1.mp3": 261,
  "reimu_closing_1.mp3": 257,
  "reimu_closing_2.mp3": 60,
  "reimu_dobon_1.mp3": 110,
  "reimu_dobon_2.mp3": 93,
  "reimu_dobon_3.mp3": 287,
  "reimu_dobon_4.mp3": 32,
  "reimu_dobon_5.mp3": 149,
  "reimu_force_1.mp3": 110,
  "reimu_force_2.mp3": 237,
  "reimu_intro_1.mp3": 108,
  "reimu_other_1.mp3": 222,
  "reimu_return_1.mp3": 30,
  "reimu_return_2.mp3": 153,
  "reimu_return_3.mp3": 45,
  "reimu_return_4.mp3": 205,
  "reimu_scoring_1.mp3": 82,
  "reimu_scoring_play_2.mp3": 190,
};

function estimateFrames(text: string): number {
  return Math.ceil((text.length * 0.15 + 0.5) * FPS);
}

interface LineInput {
  speaker: Speaker;
  text: string;
  faceA?: MarisaFace;
  faceB?: ReimuFace;
}

const SPEAKER_NAMES: Record<Speaker, string> = {
  A: "marisa",
  B: "reimu",
};

function buildDialogues(lines: LineInput[], sceneId: string): Dialogue[] {
  const dialogues: Dialogue[] = [];
  let currentFrame = 0;
  const speakerCount: Record<string, number> = { A: 0, B: 0 };

  for (let i = 0; i < lines.length; i++) {
    const { speaker, text, faceA = "normal", faceB = "normal" } = lines[i];
    speakerCount[speaker]++;
    const speakerName = SPEAKER_NAMES[speaker];
    const num = speakerCount[speaker];
    const audioFile = `${speakerName}_${sceneId}_${num}.mp3`;
    const durationFrames = VOICE_DURATIONS[audioFile] ?? estimateFrames(text);
    dialogues.push({
      speaker,
      text,
      audio: `/tutorial/voice/${speakerName}_${sceneId}_${num}.mp3`,
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
  { speaker: A, text: "霊夢、いきなりだけど、ドボンUNOって知っているか？" },
  {
    speaker: B,
    text: "ドボンUNO？普通のUNOは知っているよ",
  },
  {
    speaker: A,
    text: "基本ルールは同じなんだけど、いくつかのローカルルールを追加したものがドボンUNOなんだ",
  },
  {
    speaker: A,
    text: "特に「ドボン」というルールが特徴的だから、ドボンUNOという名前なんだぜ",
  },
  { speaker: A, text: "まず、簡単にUNOの基本ルールをおさらいするぜ" },
];

// --- シーン2: 基本ルール ---

const basicRuleLines: LineInput[] = [
  { speaker: A, text: "最初に7枚ずつ配られる" },
  {
    speaker: A,
    text: "場のカードと同じ色か数字を切って、手札の枚数を0にすることを目指すんだぜ",
  },
  {
    speaker: B,
    text: "例えば、このシチュエーションでは、赤の7か赤のスキップか緑の5が切れるな。これは知っているよ",
  },
];

// --- シーン3: 記号カード（スライド表示） ---

const specialCardLines: LineInput[] = [
  { speaker: A, text: "数字のカード以外に記号のカードもあるぜ" },
  {
    speaker: A,
    text: "それぞれのカードの効果は、これを見てくれ",
  },
];

// --- シーン4: 固定色変えカード ---

const forceChangeLines: LineInput[] = [
  { speaker: B, text: "「固定色変え」という知らないカードがあるよ" },
  {
    speaker: A,
    text: "これは、色変えカードと同じようにいつでも出せるけど、色は選択できずにカードの色が強制的に選ばれるんだ",
  },
  {
    speaker: B,
    text: "例えば赤の固定色変えカードは、普通の色変えカードを出して赤を選んだのと同じ効果になるんだね",
    faceB: "impressed",
  },
];

// --- シーン5a: ローカルルール1 — 点数計算（スライド） ---

const scoringSlideLines: LineInput[] = [
  { speaker: A, text: "ここからローカルルールの説明をするぜ" },
  { speaker: A, text: "まずは得点計算についてだ" },
  { speaker: A, text: "それぞれのカードに、点数が設定されているぜ" },
  { speaker: A, text: "設定されている点数はこの通りだ" },
  {
    speaker: A,
    text: "この点数は、「カードに点数を表示」設定をオンにすると、このようにカードに表示されるから、覚えなくても大丈夫だぜ",
    faceA: "smile",
  },
  { speaker: B, text: "この点数をどのように使うの？" },
  {
    speaker: A,
    text: "誰かが上がったらそのゲームは終了して、上がれなかった人は手札の合計点数を上がった人に支払うんだぜ",
  },
];

// --- シーン5b: ローカルルール1 — 点数計算（プレイ画面） ---

const scoringPlayLines: LineInput[] = [
  {
    speaker: A,
    text: "例えばこんな感じだ",
  },
  {
    speaker: A,
    text: "プレイヤーAが上がったな。プレイヤーA以外のプレイヤーは、プレイヤーAに、自分の手札の合計点数を支払うんだ",
  },
  {
    speaker: A,
    text: "合計点数は画面左側に表示されているぞ",
  },
  {
    speaker: B,
    text: "ドロー4を持っていたせいで80点も取られてしまったな",
    faceB: "surprise",
  },
  {
    speaker: B,
    text: "誰かが上がりそうになったら、早めに大きな点数のカードは切っておきたいな",
  },
];

// --- シーン6: ドボン — ルール説明 + プレイ画面 ---

const dobonLines: LineInput[] = [
  { speaker: A, text: "次はこのゲームの目玉、ドボンだぜ" },
  { speaker: B, text: "プレイヤーBが赤のスキップを出してきたな" },
  { speaker: B, text: "お、ドボンボタンが明るくなったぞ" },
  {
    speaker: A,
    text: "他のプレイヤーが出したカードの点数が、自分の手札の合計点数と同じときにドボンできるんだ",
  },
  {
    speaker: B,
    text: "今回は、スキップが20点で、自分の手札が5+7+8で20。一致しているからドボンできるんだね",
    faceB: "impressed",
  },
  { speaker: B, text: "ドボン！" },
  {
    speaker: A,
    text: "ドボンすると、ドボンされた人が全員の手札の合計点数を、ドボンした人に支払うんだぜ",
  },
  {
    speaker: B,
    text: "全員分ということは、ドボンされると大きなマイナスになるね",
    faceB: "surprise",
  },
];

// --- シーン7: ドボン返し — ルール説明 + プレイ画面 ---

const dobonReturnLines: LineInput[] = [
  { speaker: A, text: "次はドボン返しだぜ" },
  { speaker: A, text: "霊夢、ドロー4を切ってみてくれ" },
  { speaker: B, text: "はい" },
  {
    speaker: B,
    text: "あー、ドボンされた。でも、ドボン返しができるみたいだ",
  },
  {
    speaker: A,
    text: "そう、ドロー4を切った後、霊夢の手札の合計点数が50になっているだろ",
  },
  {
    speaker: A,
    text: "自分がドボンされたとき、残りの手札の合計がドボンされた点数と同じなら、ドボン返しができるんだぜ",
  },
  { speaker: B, text: "ドボン返し！" },
  {
    speaker: A,
    text: "ドボン返しをすると、ドボン返しされたプレイヤーがドボン返しした人に、全員の手札の合計点数を支払うんだ",
  },
  { speaker: A, text: "カウンターが決まったぜ", faceA: "smile" },
  {
    speaker: B,
    text: "ドボン返しできる状態にしておけば、ドボンされやすい記号カードをノーリスクで切れるんだね",
    faceB: "impressed",
  },
];

// --- シーン8: その他のローカルルール（スライド表示） ---

const otherRulesLines: LineInput[] = [
  {
    speaker: A,
    text: "他にもいくつかローカルルールがあるから、これを見てくれ",
  },
  {
    speaker: B,
    text: "数は多いけど、一つ一つはそこまで難しくないから、プレイしていく中で覚えられそうだな",
  },
  {
    speaker: A,
    text: "そうだな。心配な人はCPU対戦でルールを覚えるのもいいかもな",
    faceA: "smile",
  },
];

// --- シーン9: 締め ---

const closingLines: LineInput[] = [
  { speaker: A, text: "最後に、ドボンUNOのゲーム性を確認するぜ" },
  {
    speaker: B,
    text: "ドボンされるのを警戒して大きな失点を防ぎつつ、上がりやドボンを狙って得点を稼ぐゲームということだね",
    faceB: "impressed",
  },
  {
    speaker: A,
    text: "そう。その駆け引きが面白いんだぜ",
    faceA: "smile",
  },
  { speaker: B, text: "早速やってみよう" },
];

// --- シーン組み立て ---

const SECTION_TITLE_FRAMES = FPS * 3; // 3秒間タイトル表示

interface CreateSceneOptions {
  sectionTitle?: string;
  showSectionIntro?: boolean;
  voiceId?: string;
}

function createScene(
  id: string,
  lines: LineInput[],
  demoType: DemoType,
  options: CreateSceneOptions = {},
): Scene {
  const { sectionTitle, showSectionIntro = !!sectionTitle, voiceId } = options;
  const dialogues = buildDialogues(lines, voiceId ?? id);
  // セクションイントロがある場合、ダイアログの開始フレームをずらす
  if (showSectionIntro) {
    for (const d of dialogues) {
      d.startFrame += SECTION_TITLE_FRAMES;
    }
  }
  const baseDuration = totalFrames(dialogues);
  return {
    id,
    durationFrames: showSectionIntro
      ? Math.max(baseDuration, SECTION_TITLE_FRAMES)
      : baseDuration,
    dialogues,
    demo: { type: demoType },
    sectionTitle,
    showSectionIntro,
  };
}

export const scenes: Scene[] = [
  createScene("intro", introLines, "title"),
  createScene("basic", basicRuleLines, "basicRule", {
    sectionTitle: "基本ルール",
  }),
  createScene("special", specialCardLines, "specialCards", {
    sectionTitle: "基本ルール",
    showSectionIntro: false,
  }),
  createScene("force-change", forceChangeLines, "forceChangeCards", {
    sectionTitle: "基本ルール",
    showSectionIntro: false,
    voiceId: "force",
  }),
  createScene("scoring-slide", scoringSlideLines, "scoringSlide", {
    sectionTitle: "点数計算",
    voiceId: "scoring",
  }),
  createScene("scoring-play", scoringPlayLines, "scoringPlay", {
    sectionTitle: "点数計算",
    showSectionIntro: false,
    voiceId: "scoring_play",
  }),
  createScene("dobon", dobonLines, "dobonPlay", {
    sectionTitle: "ドボン",
  }),
  createScene("dobon-return", dobonReturnLines, "dobonReturnPlay", {
    sectionTitle: "ドボン返し",
    voiceId: "return",
  }),
  createScene("other-rules", otherRulesLines, "otherRules", {
    sectionTitle: "その他のルール",
    voiceId: "other",
  }),
  createScene("closing", closingLines, "closing"),
];

export const totalDurationFrames = scenes.reduce(
  (sum, scene) => sum + scene.durationFrames,
  0,
);
