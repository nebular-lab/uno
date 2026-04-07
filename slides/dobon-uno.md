---
marp: true
theme: default
paginate: true

<!-- _class: title -->

# ドボンUNOゲームの作り方
---

## 自己紹介

- **名前:** 平野大介
- **所属:** IoT開発本部ソリューション開発2部1課 新卒3年目
- **案件:** ニチコン東京、まなびポケット
- **担当:** フロントエンド
- **マイブーム:**
  - ラジオを聞く
    - ≠ME 永田詩央里のけれけれ
    - ムーザルのプログラミング絶望ラジオ
  - 自転車
    - 近くにサイクリングロードがあったので、20kmくらい漕いできました

---

## 目次

1. 開発をしたきっかけ
2. 使用技術
3. アニメーションの実装方法
4. Colyseus: 状態同期のコード例
5. CPU: Tool Callingで行動を決定

---

## 開発をしたきっかけ

- このゲーム自体は高校生のときによくやっていた
- 先月に高校同期の結婚式があったので、それに合わせて作ってみんなでやりたいなと思った
  - (結局遊んでくれませんでした。)
- 当時性能がいいと噂のOpus 4.6がリリースされたくらいのタイミングだったので、AIに丸投げして作れそうだなと思った

---

## 使用技術

- [Colyseus](https://docs.colyseus.io/)というオンラインゲーム開発のためのフレームワークを採用
  - サーバーはTypeScript
    - Room機能
    - フロントエンドとのゲーム状態の同期機能
    - その他：タイマー機能、ログ機能、テスト用のモジュール、...
  - フロントエンドはサーバーとの通信部分まで。FEでの状態管理やUI実装の機能は無いので自作する。
    - ReactやUnityやGodotなど色々選べるが、今回は慣れているReactを選択
- デプロイ先は[Render](https://render.com/)
  - 無料のため。
- ルール説明動画は[Remotion](https://www.remotion.dev/) (Reactで動画を作るライブラリ)
  - 音声は[Yukumo!](https://www.yukumo.net/#/)、顔画像は[nicotalk＆キャラ素材配布所](http://nicotalk.com/charasozai_kt.html)

---

## アニメーションの実装方法

- アニメーションの実装は、2年前に作ったものがあったのでそれを再利用
  - 具体的な方法は記事を書いているので、こちらを参照してください。
  [オンラインUNOゲーム開発【Reactでカードアニメーション編】](https://zenn.dev/nebular/articles/7b4b05ced99a98)

---

<style scoped>
pre { font-size: 0.7em; }
</style>

## Colyseus: 状態同期のコード例

```typescript
// スキーマ定義（packages/shared/src/schema/）
class GameState extends Schema {
  @type("string") phase: string = "waiting";
  @type({ map: Player }) players = new MapSchema<Player>();
  @type([Card]) fieldCards = new ArraySchema<Card>();
}
class Player extends Schema {
  @type("number") handCount: number = 0;  // 全員に見える
  @type([Card]) myHand = new ArraySchema<Card>();  // 自分だけに見える（filterで制御）
}
```

```typescript
// サーバー側: stateを更新するだけでクライアントに自動同期
const player = this.state.players.get(sessionId);
player.myHand.splice(cardIndex, 1); // 手札から削除
this.state.fieldCards.push(card); // 場に追加
player.handCount = player.myHand.length; // 手札枚数を更新
```

```typescript
// クライアント側: 状態変更を監視
room.onStateChange((state) => {
  updateUI(state);
});
```

---

## CPU: Tool Callingで行動を決定

- **Vercel AI SDK**を使用、Groqのモデルとして**llama-3.3-70b-versatile**を採用
- LLMにゲーム状態を渡して、**Tool Calling**でアクションを選ばせる
- 1アクション = 1Tool（playCard, drawCard, pass, dobon など）
- **そのとき可能なアクションのToolだけを渡す**ことで、不正な行動を構造的に防止
  - 例: カードを引けない状況では`drawCard`ツール自体を渡さない
- ドボン・ドボン返しなど**判断不要なアクションはLLMを呼ばずに即実行**
- 戦略のプロンプトを渡す。
  - あまり機能してくれていない様子。

---

<style scoped>
pre { font-size: 0.66em; }
</style>

## CPU: コード例

```typescript
// アクションをToolとして定義
const cpuTools = {
  playCard: tool({
    description: "手札からカードを1枚出す",
    inputSchema: z.object({ cardId: z.string() }),
  }),
  drawCard: tool({ description: "山札から1枚引く", inputSchema: z.object({}) }),
  pass:     tool({ description: "パスする",         inputSchema: z.object({}) }),
  dobon:    tool({ description: "ドボンを宣言する", inputSchema: z.object({}) }),
  // ...
};
```

```typescript
// 可能なアクションのToolだけをフィルタして渡す
const availableTools = filterAvailableTools(cpuPlayer);
const result = await generateText({
  model: groq("llama-3.3-70b-versatile"),
  tools: availableTools,
  toolChoice: "required",
  system: strategyPrompt,
  prompt: gameStateContext,
});
const action = result.toolCalls[0]; // → { toolName: "playCard", input: { cardId: "r5" } }
```

---

<style scoped>
section { font-size: 1rem; }
h2 { font-size: 1.4em; }
h3 { font-size: 1.1em; }
.columns { display: flex; gap: 1.2em; }
.columns .col { flex: 1; }
</style>

## CPU: 戦略プロンプト

<div class="columns">
<div class="col">

### 基本戦略

**優先順位:**
1. 出せるカードがあれば出し、上がりを目指す
2. 記号カード（Skip, Reverse, +2, Wild, +4）は早めに切る
3. 手札合計を0〜9, 10, 20, 30, 50点に調整し、ドボンを狙う

**色選択:** 手札に多い色、または次に出したいカードの色を選ぶ

</div>
<div class="col">

### リスクとリターンの判断

**リスク（相手にドボンされる危険）:**
- 相手が「カードを引いた: いいえ」の場合のみ警戒
- 手札が1,2枚 → 0〜9を警戒
- 手札1,3,4枚 → 20点を警戒
- 手札4〜7枚 → 30, 50点も警戒
- 残り枚数が多いほど、ドボンされた時のダメージ大

**リターン（攻めるべき場面）:**
- 手札が少ない → 積極的に出して上がりを目指す
- 手札合計がドボン可能点数 → ドボン狙いで攻める
- 場が安全な点数になるカード → 出してOK

**判断:** 手札が多いなら守り重視、少ないなら攻め重視

</div>
</div>
