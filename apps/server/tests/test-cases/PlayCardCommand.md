# PlayCardCommand テストケース一覧

仕様書（game-rule.md）に基づいた網羅的なテストケース

---

## 実装仕様の確認事項

このテストケースは以下の実装仕様に基づいて作成されています：

### 重ね出し
- Payloadを`cardIds: string[]`に変更、全カードが同じ（色・値が一致）か検証
- **スキップの重ね出し**: n枚 = moveToNextPlayer() × (n×2) 回実行
  - 例: スキップ2枚 = 3人スキップ（player1→2→3→4→5で、2,3,4がスキップされ5のターン）
- **リバースの重ね出し**: n枚 = turnDirection *= -1 を n回実行
  - 例: リバース2枚 = 2回反転で元の方向
- **ドロー2の重ね出し**: n枚 = drawStack += (n×2)
- **ドロー4の重ね出し**: n枚 = drawStack += (n×4)

### 上がり禁止
- 記号カード（スキップ、リバース、ドロー2、ワイルド、ドロー4、**強制色変え**）で上がることはできない
- updateAllPlayerActions() で playableCards[cardId] = false に設定
- validate() は playableCards の値をチェックするだけ

### ドロー累積
- ドロー2の累積: ドロー2またはドロー4で返せる
- ドロー4の累積: ドロー4のみで返せる（ドロー2は不可）
- 色選択: ドロー4を出した直後に色選択タイマー開始

### 強制色変えカード
- waitingForColorChoice = false（自動色更新）
- 記号カード扱い（上がり禁止）
- 常に出せるカード（ワイルドと同じ）

### ドボン
- 制限時間: 10秒
- 複数人がドボン可能
- player2がドボンした後も、player3は10秒以内ならドボン可能（両方上がれる）

### カットイン
- PlayCardCommandで実装（CutInCommandは不要）
- **制限時間タイマーなし**（次のプレイヤーのアクションまで可能）
- カットイン後の手番: カットインした人の次
- 上がりカードへのカットイン: 不可（canCutIn = false）
- ワイルド/ドロー4のカットイン: カットインした人が色を選択
- 色選択中のカットイン: 元の色選択タイマー停止、カットインした人が色選択
- ドロー累積中のカットイン: 可能、累積継続

---

## 1. 基本動作

### 1.1 通常カードを出す

- ✅ **既存テスト**: 赤の 5 を出したら、場に追加され、手札から削除される
- ✅ **既存テスト**: 次のプレイヤーに手番が移る
- ✅ **既存テスト**: currentColor が更新される

### 1.2 色が合致するカード

- [ ] 場が赤 3、手札に赤 5 を出す → 出せる
- [ ] 場が青 7、手札に青スキップを出す → 出せる

### 1.3 数字が合致するカード

- [ ] 場が赤 5、手札に青 5 を出す → 出せる
- [ ] 場が緑 3、手札に黄 3 を出す → 出せる

### 1.4 記号が合致するカード

- [ ] 場が赤スキップ、手札に青スキップを出す → 出せる
- [ ] 場が緑リバース、手札に黄リバース を出す → 出せる

---

## 2. 特殊カード効果

### 2.1 スキップ

- ✅ **既存テスト**: スキップを出したら、次のプレイヤーをスキップする
- [ ] 3 人プレイで、player1 がスキップ → player2 がスキップされ、player3 のターン
- [ ] スキップを出したプレイヤーのタイマーが停止される
- [ ] スキップされたプレイヤーのターンスタートアクションが送信されない

### 2.2 リバース

- ✅ **既存テスト**: リバースを出したら、turnDirection が反転する
- [ ] 時計回り(1) → 反時計回り(-1)
- [ ] 反時計回り(-1) → 時計回り(1)
- [ ] 3 人プレイで、player1→player2→player3 が、player1→player3→player2 になる

### 2.3 ドロー 2

- ✅ **既存テスト**: ドロー 2 を出したら、drawStack が+2 される
- [ ] drawStack が 0 → 2 になる
- [ ] drawStack が 2（既に累積）→ 4 になる
- [ ] 次のプレイヤーの canDrawStack が true になる

### 2.4 ドロー 4

- [ ] ドロー 4 を出したら、drawStack が+4 される
- [ ] drawStack が 0 → 4 になる
- [ ] drawStack が 2（ドロー 2 累積）→ 6 になる
- [ ] waitingForColorChoice が true になる
- [ ] 現在のプレイヤーの色選択タイマーが 5 秒で開始される
- [ ] 手番が移動しない（色選択後に移動）

### 2.5 ワイルド

- ✅ **既存テスト**: ワイルドを出したら、色選択待ちになる
- ✅ **既存テスト**: waitingForColorChoice が true になる
- ✅ **既存テスト**: 手番はまだ player1 のまま（色選択が終わるまで）
- ✅ **既存テスト**: タイマーが開始されている（player1.timeRemaining > 0）
- [ ] drawStack は変わらない
- [ ] currentColor は更新されない（色選択後に更新）

### 2.6 強制色変え

- [ ] 強制色変えを出したら、カードの色が自動的に選択される
- [ ] 赤の強制色変えを出す → currentColor が"red"になる
- [ ] 青の強制色変えを出す → currentColor が"blue"になる
- [ ] waitingForColorChoice は false のまま
- [ ] 次のプレイヤーに手番が移る

---

## 3. 重ね出し（2 枚以上同時に出す）

### 3.1 数字カードの重ね出し

- [ ] 赤 5 を 2 枚同時に出す → 場に赤 5 が 2 枚追加される
- [ ] 手札から 2 枚削除される
- [ ] handCount が 2 減る
- [ ] 次のプレイヤーに手番が移る

### 3.2 記号カードの重ね出し

#### スキップの重ね出し
- [ ] 青スキップを 2 枚同時に出す → 効果が 2 回発動
- [ ] 1→2→3→4→5→6 で、player1 が青スキップ ×2 → player2,3,4 がスキップされ、player5 のターンになる（3人スキップ）
- [ ] スキップ 1 枚 = moveToNextPlayer() × 2 回
- [ ] スキップ 2 枚 = moveToNextPlayer() × 4 回
- [ ] スキップ n 枚 = moveToNextPlayer() × (n×2) 回

#### リバースの重ね出し
- [ ] 青リバース を 2 枚同時に出す → turnDirection が 2 回反転（元に戻る）
- [ ] 青リバース を 3 枚同時に出す → turnDirection が 3 回反転（逆方向）
- [ ] リバース n 枚 = turnDirection *= -1 を n 回実行

#### ドロー2の重ね出し
- [ ] 赤ドロー 2 を 2 枚同時に出す → drawStack が+4 される
- [ ] 赤ドロー 2 を 3 枚同時に出す → drawStack が+6 される
- [ ] ドロー 2 を n 枚 = drawStack += (n×2)

### 3.3 ワイルドの重ね出し

- [ ] ワイルドを 2 枚同時に出す → waitingForColorChoice が true になる

#### ドロー4の重ね出し
- [ ] ドロー 4 を 2 枚同時に出す → drawStack が+8 される
- [ ] ドロー 4 を 3 枚同時に出す → drawStack が+12 される
- [ ] ドロー 4 を n 枚 = drawStack += (n×4)

### 3.4 数字カードの重ね出しで上がり

- [ ] 手札が赤 5×2 枚のみのとき → 2 枚同時に出して上がれる
- [ ] handCount が 0 になる
- [ ] ゲーム終了処理が開始される（EndGameCommand が dispatch）

---

## 4. ドロー累積

### 4.1 ドロー 2 への対応

- [ ] drawStack=2 の状態で、ドロー 2 を出す → drawStack が 4 になる
- [ ] drawStack=2 の状態で、ドロー 4 を出す → drawStack が 6 になる
- [ ] drawStack=2 の状態で、通常カードは出せない（バリデーションエラー）

### 4.2 ドロー 4 への対応

- [ ] drawStack=4 の状態で、ドロー 4 を出す → drawStack が 8 になる
- [ ] drawStack=4 の状態で、ドロー 2 は出せない（バリデーションエラー）

### 4.3 累積後の色選択

- [ ] drawStack=2、ドロー 4 を出す → 色選択待ちになる
- [ ] 最後に出したプレイヤーのみが色を選択する

---

## 5. canDobon の更新（カードを出した後の状態）

### 5.1 ドボン可能プレイヤーの検出

- [ ] player1 が 5 点のカードを出す
- [ ] player2 の手札が「2 点+3 点=5 点」のとき
  - player2.canDobon = true
  - player2 のドボンタイマーが 10 秒で開始される
- [ ] player3 の手札が「10 点」のとき
  - player3.canDobon = false（点数が合わない）

### 5.2 記号カードでのドボン

- [ ] player1 がドロー 2(20 点)を出す
- [ ] player2 の手札が「20 点」のとき
  - player2.canDobon = true
- [ ] player3 の手札が「ドロー 2(20 点)」1 枚のみのとき
  - player3.canDobon = true（記号カードの手札でもドボン可能）

### 5.3 複数人がドボン可能

- [ ] player1 が 20 点のカードを出す
- [ ] player2 の手札が「20 点」のとき
  - player2.canDobon = true
  - player2 のタイマーが 10 秒で開始
- [ ] player3 の手札が「20 点」のとき
  - player3.canDobon = true
  - player3 のタイマーも 10 秒で開始（並行）
- [ ] player2 がドボンした後も、player3 は 10 秒以内であればドボン可能
- [ ] 両方とも上がれる（排他的ではない）

### 5.4 重ね出しの場合の点数計算

- [ ] player1 が赤 5×2 枚（合計 10 点）を出す
- [ ] player2 の手札が「10 点」のとき
  - player2.canDobon = true
- [ ] player3 の手札が「5 点」のとき
  - player3.canDobon = false（重ね出しの合計点で判定）

### 5.5 ドボン不可の場合

- [ ] player1 が 5 点のカードを出す
- [ ] player2 の手札が「10 点」のとき
  - player2.canDobon = false（点数が合わない）
- [ ] player1 自身
  - player1.canDobon = false（自分が出したカードにはドボンできない）

### 5.6 上がりカードに対するドボン

- [ ] player1 の手札が「5 点」の 1 枚のみ
- [ ] player1 が 5 点のカードを出す（上がり）
- [ ] player2 の手札が「5 点」のとき
  - player2.canDobon = true（上がりカードでもドボン可能）
  - player2 のタイマーが 10 秒で開始
- [ ] 誰もドボンしなければ、player1 の上がりが確定

---

## 6. カットイン

**注意**: このセクションは、カードを出した結果として「canCutInフラグが更新される」テストと、「カットインを実行した時の動作」テストの両方を含みます。

### 6.1 canCutInフラグの更新（カードを出した結果）

- [ ] player1 が赤 5 を出す → player2 が赤 5 を持っている → player2 でカットイン可能
- [ ] player2 の canCutIn["red-5"] = true（自分のターンでなくても）

### 6.2 カットインのタイマー

- [ ] カットインには制限時間タイマーが**起動しない**
- [ ] 次のプレイヤーがアクションを起こすまで、いつでもカットイン可能
- [ ] state に canCutIn フラグを持ち、次のアクション実行時にリセット

### 6.3 カットイン後の手番

- [ ] player1→player2→player3→player4 の順で、player2 の手番中に player4 がカットイン
- [ ] 手番は player4 の次（player1）に移る
- [ ] カットインした人の次が手番（元の手番順ではない）

### 6.4 カットイン不可の場合

- [ ] 上がりカードにはカットインできない
- [ ] player1 が最後の 1 枚を出す → 他のプレイヤーの canCutIn = false
- [ ] updateAllPlayerActions() で上がりカードを検出したら、全プレイヤーの該当カードの canCutIn = false

### 6.5 ワイルド/ドロー4 のカットイン時の色選択

- [ ] player1 がワイルドを出して赤を選択
- [ ] player3 がワイルドでカットイン
- [ ] player3 が新たに色を選択する（player1 の赤選択は無効）
- [ ] ドロー 4 のカットインでも同じ扱い

### 6.6 色選択中のカットイン処理

- [ ] player1 がワイルドを出して色選択タイマー（5 秒）が動いている最中
- [ ] player3 がワイルドでカットイン
- [ ] player1 の色選択タイマーは停止される
- [ ] player1 の色選択は無効になる
- [ ] player3 の色選択タイマーが新たに開始（5 秒）

### 6.7 ドロー累積中のカットイン

- [ ] player1 がドロー 2 を出す（drawStack=2）
- [ ] player2 の手番（ドロー 2 を返すか drawStack を引くか選択中）
- [ ] player3 が同じドロー 2 でカットイン可能
- [ ] player3 がカットイン → drawStack += 2（合計 4 枚）
- [ ] 次の player4 がドロー 2/4 を返すか、4 枚引くか選択

---

## 7. playableCards の更新（カードを出した後の状態）

### 7.1 通常カードを出した後

- [ ] player1 が赤 5 を出す
- [ ] player2 の playableCards が更新される
  - player2 の手札に赤のカードがあれば → playableCards[cardId] = true
  - player2 の手札に 5 のカードがあれば → playableCards[cardId] = true
  - player2 の手札にワイルドがあれば → playableCards[cardId] = true
  - 色も数字も合わないカード → playableCards[cardId] = false

### 7.2 記号カードで上がり禁止の反映

- [ ] player1 が赤 3 を出す
- [ ] player2 の手札が「青スキップ」の 1 枚のみのとき
  - player2.playableCards["blue-skip"] = false（記号上がり禁止）
- [ ] player3 の手札が「青スキップ、青 3」の 2 枚のとき
  - player3.playableCards["blue-skip"] = true（他にカードがあるので出せる）
  - player3.playableCards["blue-3"] = true
- [ ] player4 の手札が「強制色変え（赤）」の 1 枚のみのとき
  - player4.playableCards["force-color-red"] = false（記号カード扱いで上がり禁止）
- [ ] player5 の手札が「強制色変え（赤）、赤 3」の 2 枚のとき
  - player5.playableCards["force-color-red"] = true（他にカードがあるので出せる）

### 7.3 記号カードの重ね出しで上がり禁止

- [ ] player1 が赤 5 を出す
- [ ] player2 の手札が「青 5×2 枚」のみのとき
  - player2.playableCards["blue-5-1"] = true（数字カードは重ね出しで上がれる）
  - player2.playableCards["blue-5-2"] = true
- [ ] player3 の手札が「青スキップ ×2 枚」のみのとき
  - player3.playableCards["blue-skip-1"] = false（記号カードは重ね出しでも上がれない）
  - player3.playableCards["blue-skip-2"] = false

### 7.4 ドロー累積中の playableCards

- [ ] player1 がドロー 2 を出す（drawStack=2）
- [ ] player2 の playableCards が更新される
  - player2 の手札にドロー 2 があれば → playableCards[cardId] = true
  - player2 の手札にドロー 4 があれば → playableCards[cardId] = true
  - player2 の手札に数字カードがあっても → playableCards[cardId] = false
  - player2 の手札にスキップがあっても → playableCards[cardId] = false
  - player2 の手札にワイルドがあっても → playableCards[cardId] = false
  - player2 の手札に強制色変えがあっても → playableCards[cardId] = false

### 7.5 ドロー 4 累積中の playableCards

- [ ] player1 がドロー 4 を出す（drawStack=4）
- [ ] player2 の playableCards が更新される
  - player2 の手札にドロー 4 があれば → playableCards[cardId] = true
  - player2 の手札にドロー 2 があっても → playableCards[cardId] = false（ドロー 4 にはドロー 4 のみ）

### 7.6 色選択待ち中の playableCards

- [ ] player1 がワイルドを出す（waitingForColorChoice=true）
- [ ] player1 は色選択中で、まだ手番が移動していない
- [ ] player1 の playableCards がすべて false になる（色選択が完了するまで出せない）
- [ ] player2, player3 の playableCards もすべて false（自分の手番ではない）

### 7.7 自分の手番でないときの playableCards

- ✅ **既存テスト**: 自分のターンでないときにカードを出しても無視される
- [ ] player1 が赤 5 を出す → player2 のターンになる
- [ ] player1 の playableCards がすべて false（自分の手番ではない）
- [ ] player3 の playableCards がすべて false（自分の手番ではない）
- [ ] player2 の playableCards のみ正しく設定される

### 7.8 カードの合致判定

- [ ] player1 が赤 5 を出す
- [ ] player2 の手札に「青 3、緑 5、赤 7、ワイルド、強制色変え（青）」があるとき
  - playableCards["blue-3"] = false（色も数字も合わない）
  - playableCards["green-5"] = true（数字が合う）
  - playableCards["red-7"] = true（色が合う）
  - playableCards["wild"] = true（ワイルドは常に出せる）
  - playableCards["force-color-blue"] = true（強制色変えは常に出せる）

### 7.9 その他のアクション可否フラグ

- [ ] player1 が赤 5 を出す → player2 のターンになる
- [ ] player2 のアクション可否が更新される
  - player2.canPass = false（まだカードを引いていない）
  - player2.canDraw = true（山札を引ける）
  - player2.canDrawStack = false（drawStack=0）
  - player2.canChooseColor = false（色選択待ちではない）
  - player2.canDobonReturn = false（ドボンされていない）

### 7.10 ドロー累積中のアクション可否

- [ ] player1 がドロー 2 を出す（drawStack=2）→ player2 のターンになる
- [ ] player2 のアクション可否が更新される
  - player2.canDrawStack = true（累積カードを引ける）
  - player2.canDraw = false（通常ドローはできない）
  - player2.canPass = false（パスできない）

### 7.11 色選択待ち中のアクション可否

- [ ] player1 がワイルドを出す（waitingForColorChoice=true）
- [ ] player1 のアクション可否が更新される
  - player1.canChooseColor = true（色選択できる）
  - player1.canPass = false（色選択が完了するまでパスできない）
  - player1.canDraw = false（色選択が完了するまで引けない）

### 7.12 バリデーションのチェック（validate メソッド）

- [ ] player1 のターンで、playableCards["red-5"] = false のカードを出そうとする
- [ ] validate メソッドで弾かれる
- [ ] カードは出されない、handCount は変わらない、手番も移動しない
- [ ] player2 のターンで、playableCards["blue-3"] = true のカードを出そうとする
- [ ] validate メソッドを通過
- [ ] カードが出される

---

## 8. 上がり処理

### 8.1 通常上がり

- [ ] 手札が数字カード 1 枚のとき → そのカードを出して上がる
- [ ] handCount が 0 になる
- [ ] EndGameCommand が dispatch される
- [ ] 得点計算が行われる
- [ ] gameHistory に結果が記録される

### 8.2 重ね出しで上がり

- [ ] 手札が赤 5×2 枚のみのとき → 2 枚同時に出して上がる
- [ ] handCount が 0 になる
- [ ] EndGameCommand が dispatch される

### 8.3 上がりに対するドボン

- [ ] player1 が最後の 1 枚を出す → player2 がドボン可能 → player2.canDobon が true
- [ ] ドボンタイマーが開始される
- [ ] ドボンが成立するまで上がりは確定しない

### 8.4 記号カードで上がれない playableCards の設定

- [ ] player1 が赤 5 を出す
- [ ] player2 の手札が「青スキップ」の 1 枚のみ
  - player2.playableCards["blue-skip"] = false（記号上がり禁止）
  - player2.canPass = false（手番が来てもパスできない）
  - player2 は何もできない状態（実質的に詰み状態だが、山札を引くことはできる）
- [ ] player2 が「青スキップ」を出そうとする
  - validate で弾かれる（playableCards["blue-skip"] = false）
  - カードは出されない

---

## 9. タイマー管理

### 9.1 手番タイマーの開始

- [ ] カードを出したら、現在のプレイヤーのタイマーが停止される
- [ ] 次のプレイヤーのタイマーが 10 秒で開始される

### 9.2 色選択タイマーの開始

- [ ] ワイルドを出したら、5 秒のタイマーが開始される
- [ ] ドロー 4 を出したら、5 秒のタイマーが開始される

### 9.3 ドボンタイマーの開始

- [ ] ドボン可能なプレイヤーのタイマーが 10 秒で開始される
- [ ] 複数人がドボン可能な場合、全員のタイマーが開始される（並行）

### 9.4 タイマーの停止

- [ ] カードを出す前に、現在のプレイヤーのタイマーが停止される
- [ ] ドボンタイマーは次のアクションで停止される

---

## 10. アクション通知

### 10.1 playCard アクションのブロードキャスト

- [ ] room.broadcast("playerAction", {...})が呼ばれる
- [ ] type: "playCard"
- [ ] playerId, seatId, playerName が正しい
- [ ] cardId が正しい
- [ ] timestamp が記録される

### 10.2 全プレイヤーへの通知

- [ ] カードを出したプレイヤー以外にも通知される
- [ ] 観戦者にも通知される（実装されている場合）

---

## 11. エッジケース

### 11.1 山札切れの直前

- [ ] 山札が 1 枚のとき、カードを出す → 正常に動作
- [ ] deckCount が更新される

### 11.2 2 人プレイでのスキップ

- [ ] 2 人プレイでスキップ → 相手をスキップして自分のターンに戻る
- [ ] 無限ループにならない

### 11.3 2 人プレイでのリバース

- [ ] 2 人プレイでリバース → turnDirection が反転するが、実質的には次のプレイヤーは同じ

### 11.4 連続カットイン

- [ ] player1 がカードを出す → player2 がカットイン → player3 がカットイン
- [ ] 手番が player3 の次に移る

### 11.5 ドロー 4 の重ね出し

- [ ] player1 がドロー 4 を 3 枚重ね出し
- [ ] drawStack が 12 になる
- [ ] player1 が色選択する（1回のみ）

### 11.6 ドロー 4 累積中にカットイン

- [ ] player1 がドロー 4（drawStack=4）
- [ ] player2 の色選択中に、player3 がドロー 4 でカットイン
- [ ] player2 の色選択タイマーが停止される
- [ ] drawStack が 8 になる
- [ ] player3 が色選択する

---

## テストの観点

### 重要な設計思想

**validate メソッドの役割:**

- `playableCards[cardId]`の値をチェックするだけ
- カードが出せるかどうかのロジックは`updateAllPlayerActions()`で実装

**テストすべきこと:**

1. カードを出した後、`updateAllPlayerActions()`が呼ばれる
2. 各プレイヤーの`playableCards`が正しく更新される
3. `canDobon`が正しく更新される
4. その他のアクション可否フラグが正しく更新される
5. `validate()`メソッドは`playableCards[cardId]`の値をチェックするだけ

**テストすべきでないこと:**

- 「このカードを出そうとしたら弾かれる」というテストは不要
- 代わりに「このカードを出した後、他のプレイヤーの状態がどうなるか」をテスト

---
