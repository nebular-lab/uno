# ゲームUI アーキテクチャ

## 配置方式

ゲーム画面のUI配置には `relative` + `absolute` パターンを採用する。

### 基本構造

```tsx
// 親コンテナ
<div className="relative h-full w-full">
  {/* 子要素は全て absolute で配置 */}
  <div className="absolute top-16 inset-x-0 mx-auto">...</div>
  <div className="absolute top-52 right-0">...</div>
  <div className="absolute bottom-0 w-full">...</div>
</div>
```

### 配置ルール

1. **親コンテナ**: `relative h-full w-full`
2. **子要素**: 全て `absolute` + Tailwindクラスで位置指定
3. **位置指定例**:
   - 上中央: `top-16 inset-x-0 mx-auto`
   - 右上: `top-52 right-0`
   - 下部全幅: `bottom-0 w-full`

### メリット

- 各要素の位置を独立して制御可能
- レスポンシブ対応が容易
- 要素の重なり順を `z-index` で明示的に管理可能

## サンプルコード

ポーカーゲームの縦長UIの実装例が以下にある:

```
temp/front/src/in-game-scene/
├── index.tsx                    # メインコンポーネント（向き判定）
├── components/
│   ├── common/
│   │   ├── poker-table-container.tsx  # 親コンテナ
│   │   ├── player-seat.tsx            # プレイヤー配置
│   │   └── ...
│   └── portrait/
│       ├── index.tsx                  # 縦長レイアウト
│       ├── portrait-poker-table.tsx   # テーブル（楕円）
│       └── portrait-action-buttons.tsx # 操作ボタン
└── index.stories.tsx            # Storybook（モックデータあり）
```

### 参考ファイル

| ファイル                    | 内容                                  |
| --------------------------- | ------------------------------------- |
| `poker-table-container.tsx` | `relative h-full w-full` の親コンテナ |
| `player-seat.tsx`           | 6人分の位置定義配列と配置ロジック     |
| `portrait/index.tsx`        | 縦長画面でのabsolute配置例            |
| `scalable-container.tsx`    | 画面サイズに応じたスケーリング        |
