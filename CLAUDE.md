# ドボン UNO - 開発ガイド

このドキュメントは AI（Claude）が開発を支援する際のガイドラインです。

## ⚠️ 重要: タスク完了後の必須チェック

**すべてのコード変更後、必ず以下のチェックを実行してください：**

```bash
# 1. Biomeチェック（lint + format）
pnpm check

# 2. TypeScript型チェック
pnpm typecheck
```

**エラーが出た場合は必ず解消してください。**

- `pnpm check`でエラーが出た場合 → `pnpm fix`で自動修正、または手動で修正
- `pnpm typecheck`でエラーが出た場合 → 型エラーを手動で修正

チェックが通るまでタスクは完了していません。

---

## 📁 プロジェクト構成

```
dobon-uno/
├── apps/
│   ├── server/              # Colyseusサーバー
│   └── client/              # フロントエンド（React + Vite）
├── packages/
│   └── shared/              # @dobon-uno/shared - 共通型定義・定数
│       └── src/
│           ├── schema/      # Colyseusスキーマクラス
│           ├── action.ts    # アクション型定義
│           └── card.ts      # カード定数
├── doc/                     # ドキュメント
│   ├── schema.md            # スキーマ定義
│   ├── action.md            # アクション定義
│   └── spec/                # 仕様書
├── .husky/                  # Git hooks
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.base.json
```
