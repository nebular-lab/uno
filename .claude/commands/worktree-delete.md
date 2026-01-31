worktreeとブランチを削除します。

## 引数

$ARGUMENTS に以下の形式で指定されます：

```
[ブランチ名]
```

- **ブランチ名**: オプション。指定がない場合は現在のworktreeを削除

例:

- （引数なし） → 現在いるworktreeを削除
- `feature-login` → feature-loginのworktreeを削除

## 手順

1. **現在の場所を確認**
   - `pwd` で現在のディレクトリを確認
   - 現在のブランチ名を `git branch --show-current` で取得
   - $ARGUMENTS が指定されている場合はそのブランチ名を使用
   - mainブランチで引数もない場合は、どのworktreeを削除するか確認

2. **削除対象のworktreeが存在するか確認**
   - `git worktree list` でworktree一覧を確認
   - 対象のworktreeが存在しない場合はエラー

3. **未マージのコミットがあるか確認**
   - `git log main..<ブランチ名> --oneline` で未マージのコミットを確認
   - 未マージのコミットがある場合はユーザーに警告し、本当に削除するか確認

4. **未コミットの変更を確認**
   - `git status` で未コミットの変更がないか確認
   - 変更がある場合はユーザーに警告し、本当に削除するか確認

5. **mainディレクトリに移動**

   ```bash
   cd /Users/daisukehirano/Documents/src/dobon-uno/main
   ```

6. **worktreeとブランチの削除**

   ```bash
   git worktree remove ../<ブランチ名>
   git branch -d <ブランチ名>
   ```

   - `-d` で削除できない場合（未マージのコミットがある場合）、ユーザーの確認を得てから `-D` で強制削除

7. **完了メッセージ**
   - worktreeとブランチが削除されたことを報告
   - 現在mainディレクトリにいることを確認

## 注意事項

- mainブランチ・mainディレクトリは削除できません
- 未マージのコミットがある場合は警告が表示されます
- 削除は取り消せません。必要な変更は事前にマージしてください
- リモートブランチは削除しません（必要に応じて手動で削除）
