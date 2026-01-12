# ドボンUNO

Colyseus + React で作るマルチプレイヤー対応のドボンUNOゲーム

## 🎮 概要

ドボンUNOは、UNOをベースにした日本独自の遊び方「ドボン」を実装したオンラインカードゲームです。

## 🛠️ 技術スタック

- **サーバー**: Colyseus (WebSocket)
- **クライアント**: React + Vite
- **言語**: TypeScript
- **パッケージ管理**: pnpm workspaces

## 🚀 クイックスタート

```bash
# 依存関係のインストール
pnpm install

# 共通パッケージのビルド
pnpm build:shared

# 開発サーバー起動
pnpm dev
```

サーバー: http://localhost:2567
クライアント: http://localhost:5173

## 📚 ドキュメント

詳細な開発ガイドは [CLAUDE.md](./CLAUDE.md) を参照してください。

- [開発ガイド](./CLAUDE.md) - セットアップ、開発フロー、コマンド一覧
- [スキーマ定義](./doc/schema.md) - Colyseusスキーマの詳細
- [アクション定義](./doc/action.md) - プレイヤーアクションの型定義
- [ゲームルール](./doc/spec/game-rule.md) - ドボンUNOのルール

## 🔧 主要コマンド

```bash
pnpm dev          # 開発サーバー起動（server + client）
pnpm check        # Biomeチェック（lint + format）
pnpm typecheck    # TypeScript型チェック
pnpm build        # プロダクションビルド
pnpm test         # テスト実行
```

## 📁 プロジェクト構成

```
dobon-uno/
├── apps/
│   ├── server/       # Colyseusサーバー
│   └── client/       # Reactクライアント
├── packages/
│   └── shared/       # 共通型定義・定数
└── doc/              # ドキュメント
```

## 📄 ライセンス

MIT
