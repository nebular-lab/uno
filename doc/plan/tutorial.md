# チュートリアル動画 実装計画

ゆっくり動画形式のチュートリアルを Remotion で作成し、タイトル画面から再生できるようにする。

**参照ドキュメント:**

- `doc/spec/game-rule.md` - ゲームルール全体
- `apps/client/src/components/tutorial/data/script.ts` - 台本データ

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
│ A: 場が赤の5なら、赤か5を出す           │
└─────────────────────────────────────────┘
```

- **デモ領域（上部）**: ゲーム画面のカード等をアニメーションで表示
- **キャラクター**: デモ領域の左下・右下に立ち絵を配置。発話中のキャラをアニメーション（拡大・明るくなる等）で強調
- **字幕バー（下部）**: 半透明背景に発話者名＋テキスト

### 動画スペック

| 項目   | 値                     |
| ------ | ---------------------- |
| 解像度 | 960×540                |
| FPS    | 30                     |
| 長さ   | 約 2〜3 分（8 シーン）  |

---

## シーン構成（台本）

台本の詳細は `apps/client/src/components/tutorial/data/script.ts` を参照。

| シーン | ID           | 内容                                       |
| ------ | ------------ | ------------------------------------------ |
| 1      | intro        | 導入（ドボン UNO とは）                     |
| 2      | basic        | 基本ルール（7 枚配る、色/数字を合わせる）   |
| 3      | special      | 記号カード（ドロー、スキップ等）と任意ドロー |
| 4      | stack-cutin  | 重ね出し・記号上がり禁止・カットイン         |
| 5      | scoring      | 点数計算（上がり時の得点）                   |
| 6      | dobon        | ドボン（メイン機能）                         |
| 7      | dobon-return | ドボン返し                                   |
| 8      | strategy     | 戦略まとめ                                   |

---

## ファイル構成

```
apps/client/src/
├── components/tutorial/
│   ├── TutorialPlayer.tsx        # @remotion/player ラッパー（実装済み）
│   ├── TutorialVideo.tsx         # Remotion Composition ルート（実装済み・仮実装）
│   ├── Subtitle.tsx              # 字幕バーコンポーネント
│   ├── characters/
│   │   ├── Character.tsx         # キャラクター立ち絵コンポーネント
│   │   └── assets/              # キャラクター画像（2体分）
│   ├── demo/
│   │   └── DemoCards.tsx         # デモ領域のカードアニメーション
│   └── data/
│       └── script.ts            # 全シーンの台本データ（実装済み）
├── screens/
│   └── TitleScreen.tsx           # 「ルール説明」ボタン（実装済み）
public/
└── tutorial/
    └── voice/                    # VOICEVOX 生成音声ファイル
scripts/
└── generate-voice.ts             # VOICEVOX 音声一括生成スクリプト
```

---

## 追加パッケージ

### クライアント（apps/client）— 実装済み

```
remotion              # Remotion コア
@remotion/player      # ブラウザ内再生コンポーネント
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

### Step 1: Remotion セットアップ — 完了

- `remotion` と `@remotion/player` をインストール
- 最小構成で `<Player>` が表示されることを確認
- タイトル画面に「ルール説明」ボタンを追加

### Step 2: 台本データ作成 — 完了

- 全 8 シーンの台本を `data/script.ts` に定義
- 音声ファイルパスは自動生成
- フレーム数はテキスト長から仮算出（VOICEVOX 音声生成後に調整）

### Step 3: キャラクター・字幕コンポーネント

**新規ファイル:**

- `Character.tsx` — 立ち絵表示。発話中にアニメーション（scale, brightness）
- `Subtitle.tsx` — 画面下部の字幕バー。半透明背景 + 発話者名 + テキスト

### Step 4: デモ領域コンポーネント

**新規ファイル:** `demo/DemoCards.tsx`

- 既存の `Card` コンポーネントを利用してカードを表示
- シーンごとに異なるデモコンテンツをアニメーション表示

### Step 5: TutorialVideo にシーンを組み込む

**変更ファイル:** `TutorialVideo.tsx`

- 全シーンを Remotion の `<Series>` で連結
- 各シーンで `Character` + `Subtitle` + デモ を組み合わせ
- `useCurrentFrame()` でフレームに応じた表示切替

### Step 6: VOICEVOX 音声生成

**新規ファイル:** `scripts/generate-voice.ts`

- 音声生成スクリプトを作成・実行
- 生成された音声の長さに合わせて `script.ts` の `durationFrames` を調整
- `.wav` ファイルを `public/tutorial/voice/` に配置

### Step 7: 音声同期・最終調整

- `<Audio>` で音声再生を追加
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
