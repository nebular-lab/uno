新しいworktreeブランチを作成し、セットアップして作業を開始します。

## 引数

$ARGUMENTS に以下の形式で指定されます：

```
<ブランチ名> [ポート番号]
```

- **ブランチ名**: 必須。指定がない場合はユーザーに確認してください
- **ポート番号**: オプション。サーバーのポート番号（デフォルト: 2567）

例:

- `feature-login` → ブランチ名: feature-login、ポート: 2567
- `feature-login 3000` → ブランチ名: feature-login、ポート: 3000

## 手順

1. **現在の場所を確認**
   - `pwd` で現在のディレクトリを確認
   - `/Users/daisukehirano/Documents/src/dobon-uno/main` にいることを確認
   - mainディレクトリにいない場合は、ユーザーにmainディレクトリから実行するよう案内

2. **引数の確認**
   - $ARGUMENTS をパースしてブランチ名とポート番号を取得
   - ブランチ名が空の場合、ユーザーに確認
   - ブランチ名は英数字とハイフンのみ推奨
   - ポート番号が指定されていない場合はデフォルト値 2567 を使用

3. **worktreeの作成**

   ```bash
   git worktree add ../<ブランチ名> -b <ブランチ名> main
   ```

4. **依存関係のインストール**

   ```bash
   cd ../<ブランチ名> && pnpm install
   ```

5. **.envファイルの作成**
   - サーバー用とクライアント用の.envファイルを作成

   **apps/server/.env**

   ```
   PORT=<ポート番号>
   ```

   **apps/client/.env**

   ```
   VITE_COLYSEUS_URL=ws://localhost:<ポート番号>
   ```

6. **devサーバーの起動**
   - サーバーとクライアントのdevサーバーをバックグラウンドで起動
   - 環境変数を明示的に渡して実行：
     ```bash
     cd /Users/daisukehirano/Documents/src/dobon-uno/<ブランチ名>/apps/server && PORT=<ポート番号> pnpm dev
     ```
     ```bash
     cd /Users/daisukehirano/Documents/src/dobon-uno/<ブランチ名>/apps/client && VITE_COLYSEUS_URL=ws://localhost:<ポート番号> pnpm dev
     ```
   - 起動完了を待つ（数秒程度）

7. **完了メッセージ**
   - 作成したworktreeのパスを表示
   - devサーバーが起動していることを案内：
     - サーバー: http://localhost:<ポート番号>
     - クライアント: http://localhost:5173（Viteが自動で空きポートを選択）

## 注意事項

- このコマンドは `dobon-uno/main` ディレクトリから実行する必要があります
- 既に同名のブランチが存在する場合はエラーになります
- 他のworktreeと同じポートを使用するとサーバーが起動に失敗します
- mainで開発中の場合はポート2567が使用中の可能性があるため、別のポートを指定してください
- .envファイルは.gitignoreに含まれているため、コミットされません
