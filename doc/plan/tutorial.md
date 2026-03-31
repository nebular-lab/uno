# チュートリアル動画 実装計画

ゆっくり動画形式のチュートリアルを Remotion で作成し、タイトル画面から再生できるようにする。

**参照ドキュメント:**

- `doc/spec/game-rule.md` - ゲームルール全体

---

## 概要

### 形式

- **ゆっくり動画形式**: 2 人のキャラクターが画面の左下・右下に立ち絵として登場し、会話しながらルールを説明する
- **字幕**: 画面下部に字幕バーを表示（吹き出しではない）
- **音声**: VOICEVOX で事前生成した音声ファイルを使用
- **再生方法**: `@remotion/player` でブラウザ内リアルタイム再生（MP4 書き出し不要）
- **表示場所**: タイトル画面の「ルール説明」ボタンからダイアログで表示

### 画面レイアウト

```
┌─────────────────────────────────────────┐
│                                         │
│        【ゲーム画面のデモ領域】           │
│     （カード、フィールド等のアニメ）      │
│                                         │
│                                         │
│ 🟢キャラA              キャラB🔵        │
├─────────────────────────────────────────┤
│ A: 場のカードと同じ色か数字を出せるよ！  │
└─────────────────────────────────────────┘
```

- **デモ領域（上部）**: ゲーム画面のカード等をアニメーションで表示
- **キャラクター**: デモ領域の左下・右下に立ち絵を配置。発話中のキャラをアニメーション（拡大・明るくなる等）で強調
- **字幕バー（下部）**: 半透明背景に発話者名＋テキスト

### 動画スペック

| 項目   | 値                    |
| ------ | --------------------- |
| 解像度 | 960×540               |
| FPS    | 30                    |
| 長さ   | 約 2〜3 分（8 シーン） |

---

## シーン構成（台本）

### シーン 1: 導入

- A「今日はドボン UNO のルールを説明するよ！」
- B「ドボン UNO？普通の UNO と何が違うの？」
- A「基本は同じだけど、"ドボン" っていう特別なルールがあるんだ」
- デモ: タイトルロゴ表示

### シーン 2: カードを出す（基本ルール）

- A「場のカードと同じ色か同じ数字のカードを出せるよ」
- B「赤の 5 なら、赤のカードか 5 のカードを出せばいいんだね」
- A「そう！出せるカードがなければ山札から 1 枚引いてね」
- デモ: 場に赤 5 → 手札から赤 3 や青 5 がハイライトされる

### シーン 3: 記号カードの効果

- A「スキップは次の人を飛ばす、リバースは順番が逆になるよ」
- B「ドロー 2 は？」
- A「次の人が 2 枚引く。でもドロー 2 やドロー 4 を重ねて返せるよ」
- デモ: スキップ→次の人が飛ばされる / ドロー 2 の連鎖

### シーン 4: ワイルドカード

- A「ワイルドカードはいつでも出せて、好きな色を選べるよ」
- B「ドロー 4 は？」
- A「同じくいつでも出せて、次の人が 4 枚引く。色も選べるよ」
- A「強制色変えカードは色が自動で決まるワイルドだよ」
- デモ: ワイルドカードを出す → 色選択パネル表示

### シーン 5: 重ね出し

- A「同じカードを持っていたら、まとめて出せるよ」
- B「赤の 5 が 2 枚あったら同時に出せるってこと？」
- A「その通り！数字カードの重ね出しなら上がることもできるよ」
- デモ: 同じカード 2 枚を同時に出す

### シーン 6: カットイン

- A「自分の番じゃなくても、場と全く同じカードなら割り込めるよ」
- B「え、それはずるくない？」
- A「戦略だよ！割り込んだ人の次から順番が続くんだ」
- デモ: 他プレイヤーのターン中にカットイン

### シーン 7: ドボン（メイン機能）

- A「これが一番大事！手札の合計点数が場のカードの点数と同じなら "ドボン" で上がれるよ」
- B「例えば場に 5 が出てて、手札が 2 と 3 なら...合計 5 でドボン！」
- A「そう！ドボンが成功すると、ドボンされた人が全員の手札分の点数を払うんだ」
- B「ドボン返しっていうのもあるんでしょ？」
- A「ドボンされた人の手札の合計と、ドボンした人の手札の合計が同じなら返せるよ」
- デモ: 場に 5 → 手札 2+3=5 → ドボンボタンが光る → ドボン成立

### シーン 8: まとめ

- A「カードの点数も覚えておこう。数字はそのまま、スキップ・リバース・ドロー 2 は 20 点、ワイルドは 30 点、ドロー 4 は 50 点」
- B「ドボンを狙いつつ、点数も意識するのが大事なんだね」
- A「それじゃあ、楽しんでね！」
- デモ: 点数表を表示

---

## ファイル構成

```
apps/client/src/
├── components/tutorial/
│   ├── TutorialPlayer.tsx        # @remotion/player ラッパー + ダイアログ
│   ├── TutorialVideo.tsx         # Remotion Composition ルート
│   ├── Subtitle.tsx              # 字幕バーコンポーネント
│   ├── characters/
│   │   ├── Character.tsx         # キャラクター立ち絵コンポーネント
│   │   └── assets/              # キャラクター画像（2体分）
│   ├── scenes/
│   │   ├── IntroScene.tsx        # シーン1: 導入
│   │   ├── BasicRuleScene.tsx    # シーン2: カードを出す
│   │   ├── SpecialCardScene.tsx  # シーン3: 記号カード
│   │   ├── WildCardScene.tsx     # シーン4: ワイルドカード
│   │   ├── StackScene.tsx        # シーン5: 重ね出し
│   │   ├── CutInScene.tsx        # シーン6: カットイン
│   │   ├── DobonScene.tsx        # シーン7: ドボン
│   │   └── SummaryScene.tsx      # シーン8: まとめ
│   ├── demo/
│   │   └── DemoCards.tsx         # デモ領域のカードアニメーション
│   └── data/
│       └── script.ts            # 全シーンの台本データ
├── screens/
│   └── TitleScreen.tsx           # ← 「ルール説明」ボタンを追加
public/
└── tutorial/
    └── voice/                    # VOICEVOX 生成音声ファイル
scripts/
└── generate-voice.ts             # VOICEVOX 音声一括生成スクリプト
```

---

## 追加パッケージ

### クライアント（apps/client）

```
remotion              # Remotion コア
@remotion/player      # ブラウザ内再生コンポーネント
```

### ルート（開発用）

```
（なし — 音声生成スクリプトは ts-node / tsx で直接実行）
```

---

## 台本データの型定義

```ts
// data/script.ts

type Speaker = "A" | "B";

interface Dialogue {
  speaker: Speaker;
  text: string;
  audio: string; // 音声ファイルパス（例: "/tutorial/voice/intro_00.wav"）
  startFrame: number; // 開始フレーム
  durationFrames: number; // 表示フレーム数（音声の長さに合わせる）
}

interface DemoContent {
  type: "title" | "playCard" | "specialCard" | "wildCard" | "stack" | "cutIn" | "dobon" | "scoreTable";
  // 各typeに応じた追加プロパティ
}

interface Scene {
  id: string;
  durationFrames: number; // シーン全体のフレーム数
  dialogues: Dialogue[];
  demo: DemoContent;
}
```

---

## VOICEVOX 音声生成フロー

### 前提

- VOICEVOX エンジンがローカルで起動していること（`http://localhost:50021`）
- キャラ A と B にそれぞれ異なる speaker ID を割り当てる

### 生成スクリプト（scripts/generate-voice.ts）

```
1. script.ts から全 Dialogue を読み込む
2. 各 Dialogue に対して:
   a. VOICEVOX /audio_query API でクエリ生成
   b. VOICEVOX /synthesis API で WAV 生成
   c. public/tutorial/voice/{sceneId}_{index}.wav に保存
   d. 音声の長さ（秒）を出力 → script.ts の durationFrames 調整に使用
3. 全音声のファイル一覧と長さを表示
```

### 実行方法

```bash
# 1. VOICEVOX エンジンを起動（別ターミナル）
# 2. 音声生成
npx tsx scripts/generate-voice.ts
```

---

## 作業ステップ

### Step 1: Remotion セットアップ

**変更ファイル:** `apps/client/package.json`

- `remotion` と `@remotion/player` をインストール
- 最小構成で `<Player>` が表示されることを確認

### Step 2: 台本データ作成

**新規ファイル:** `apps/client/src/components/tutorial/data/script.ts`

- 全 8 シーンの台本を定義
- 音声ファイルパスは仮で設定（音声生成後に調整）
- フレーム数は仮で設定

### Step 3: キャラクター・字幕コンポーネント

**新規ファイル:**

- `Character.tsx` — 立ち絵表示。発話中にアニメーション（scale, brightness）
- `Subtitle.tsx` — 画面下部の字幕バー。半透明背景 + 発話者名 + テキスト

### Step 4: デモ領域コンポーネント

**新規ファイル:** `demo/DemoCards.tsx`

- 既存の `Card` コンポーネントを利用してカードを表示
- シーンごとに異なるデモコンテンツをアニメーション表示

### Step 5: シーン実装

**新規ファイル:** `scenes/*.tsx`（8 ファイル）

- 各シーンで `Character` + `Subtitle` + `DemoCards` を組み合わせ
- Remotion の `useCurrentFrame()` でフレームに応じた表示切替
- `<Audio>` で音声再生（音声生成後）

### Step 6: Composition ルートとプレイヤー

**新規ファイル:**

- `TutorialVideo.tsx` — 全シーンを `<Series>` で連結
- `TutorialPlayer.tsx` — `@remotion/player` の `<Player>` をダイアログ内に表示

### Step 7: タイトル画面への組み込み

**変更ファイル:** `apps/client/src/screens/TitleScreen.tsx`

- 「ルール説明」ボタンを追加
- クリックで `TutorialPlayer` ダイアログを表示

### Step 8: VOICEVOX 音声生成

**新規ファイル:** `scripts/generate-voice.ts`

- 音声生成スクリプトを作成・実行
- 生成された音声の長さに合わせて `script.ts` の `durationFrames` を調整
- `.wav` ファイルを `public/tutorial/voice/` に配置

### Step 9: 音声同期・最終調整

- 音声と字幕のタイミングを微調整
- デモアニメーションのタイミングを音声に合わせる
- 全体の流れを通して確認

---

## キャラクター画像について

キャラクター画像は以下のいずれかで用意する（実装開始前に決定）:

1. **シンプルな SVG/CSS** — 丸顔 + 表情で自作。追加依存なし
2. **フリー素材** — いらすとや等から取得
3. **AI 生成画像** — 専用のキャラクターを生成

---

## 注意事項

- 既存の `Card` コンポーネントは Colyseus/Jotai に依存しない props ベースなので、チュートリアル内でそのまま使える
- `@remotion/player` はクライアントバンドルサイズが増えるため、動的 import（lazy load）で読み込む
- VOICEVOX のキャラクター利用規約に従い、必要に応じてクレジット表記を追加する
- 生成済み `.wav` ファイルは git に含めるか LFS にするか、ファイルサイズを見て判断する
