現在のworktreeブランチの変更をmainにマージします（worktreeは削除しません）。

## 手順

1. **現在の場所を確認**
   - `pwd` で現在のディレクトリを確認
   - 現在のブランチ名を `git branch --show-current` で取得
   - mainブランチにいる場合は、どのworktreeをマージするか確認

2. **未コミットの変更を確認**
   - `git status` で未コミットの変更がないか確認
   - 変更がある場合はユーザーに確認（コミットするか破棄するか）

3. **mainにマージ済みでないコミットがあるか確認**
   - `git log main..<ブランチ名> --oneline` でマージされていないコミットを確認
   - マージするコミットがない場合は、その旨をユーザーに伝えて終了

4. **mainブランチでマージを実行**

   ```bash
   cd /Users/daisukehirano/Documents/src/dobon-uno/main
   git merge <ブランチ名>
   ```

5. **マージコンフリクトの処理**
   - コンフリクトが発生した場合は、マージを取り消す：
     ```bash
     git merge --abort
     ```
   - ユーザーにコンフリクトが発生したことを伝える
   - 手動でマージするためのコマンドを案内：
     ```
     cd /Users/daisukehirano/Documents/src/dobon-uno/main
     git merge <ブランチ名>
     # コンフリクトを解決後
     git add .
     git commit
     ```
   - マージは実行せずに終了

6. **worktreeディレクトリに戻る**

   ```bash
   cd /Users/daisukehirano/Documents/src/dobon-uno/<ブランチ名>
   ```

7. **完了メッセージ**
   - マージが完了したことを報告
   - worktreeは削除されていないので、引き続き作業できることを案内

## 注意事項

- mainブランチ自体はマージできません
- マージ前に必ずテストが通ることを確認してください
- リモートにプッシュはしません（必要に応じて手動でプッシュ）
- worktreeは削除されないので、引き続き同じworktreeで作業を継続できます
- 作業が完全に終わったら `/worktree-delete` でworktreeを削除してください
