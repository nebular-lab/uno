# Dobon UNO Server

## セットアップ

```bash
npm install
```

## テスト実行

```bash
# 全テストを実行
npm test

# watchモードで実行
npm run test:watch

# 特定のテストファイルのみ実行
npm test PlayCardCommand.test.ts
```

## テストの構造

### @colyseus/testingを使用

Colyseusの公式テストライブラリを使用してRoomをセットアップし、実際のゲームフローをテストします。

```typescript
// Colyseusテストサーバーを起動
const colyseus = await boot({
  initializeGameServer: (gameServer) => {
    gameServer.define("game", GameRoom);
  },
});

// Roomを作成
const room = await colyseus.createRoom<GameRoom>("game", {});

// クライアントを接続
const client1 = await colyseus.connectTo(room);
const client2 = await colyseus.connectTo(room);

// ゲーム状態をセットアップ
room.state.players.set(client1.sessionId, player1);

// クライアントからメッセージを送信
await client1.send("playCard", "r5");

// 状態の変更を検証
expect(player1.handCount).toBe(0);
expect(room.state.currentTurnPlayerId).toBe(client2.sessionId);
```

## テストの例

### PlayCardCommand.test.ts

- ✅ 通常のカードを出す
- ✅ スキップカードを出す
- ✅ リバースカードを出す
- ✅ ドロー2カードを出す
- ✅ ワイルドカードを出す
- ✅ 検証: 自分のターンでない

各テストケースで以下を検証：
- 手札の枚数変化
- 場のカード変化
- 手番の移動
- ゲーム状態フラグ（drawStack, turnDirection, waitingForColorChoice）
- タイマーの開始
