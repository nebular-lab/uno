# ドボン UNO - 開発ガイド

このドキュメントは AI（Claude）が開発を支援する際のガイドラインです。

## ⚠️ 重要: タスク完了後の必須チェック

**すべてのコード変更後、必ず以下のチェックを実行してください：**

```bash
# 1. Biomeチェック（lint + format）
pnpm check

# 2. TypeScript型チェック
pnpm typecheck

# 3. テスト実行（ルール処理・CPU、サーバー）
cd packages/game-core && pnpm test
cd apps/server && pnpm test
```

**エラーが出た場合は必ず解消してください。**

- `pnpm check`でエラーが出た場合 → `pnpm fix`で自動修正、または手動で修正
- `pnpm typecheck`でエラーが出た場合 → 型エラーを手動で修正
- `pnpm test`でエラーが出た場合 → テストを修正

チェックが通るまでタスクは完了していません。

**注意: TDD（テスト駆動開発）の場合**

TDDで先にテストを書く場合は、テストが失敗している状態でも問題ありません。
実装前にテストを書き、実装後にテストがパスすることを確認してください。

---

## 📁 プロジェクト構成

```
dobon-uno/
├── apps/
│   ├── server/              # Colyseusサーバー（マルチプレイ用）
│   ├── client/              # ドボンUNO マルチプレイ（React + Vite）
│   └── single/              # ドボンUNO シングルプレイ（サーバー不要。ブラウザ内でCPUと対戦）
├── packages/
│   ├── shared/              # @dobon-uno/shared - 共通型定義・定数
│   │   └── src/
│   │       ├── schema/      # Colyseusスキーマクラス
│   │       └── card.ts      # カード定数
│   ├── game-core/           # @dobon-uno/game-core - ルール処理・CPU（サーバーとブラウザで共有）
│   └── game-ui/             # @dobon-uno/game-ui - ゲーム画面（client と single で共有）
├── doc/                     # ドキュメント
│   └── spec/                # 仕様書
├── .husky/                  # Git hooks
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.base.json
```
