# ゲーム機能実装計画

## 実装順序

1. GameStartCommand
2. PlayCardCommand
3. TimerCommand
4. DrawCardCommand
5. PassCommand
6. ChooseColorCommand
7. DrawStackDobonCommand
8. DobonReturnCommand
9. EndGameCommand

## 実装の手順

各Commandは以下の順序で実装する：

1. **Commandのテストケースを書く**
2. **Commandを実装する**
3. **UIを実装する**

## 方針

- 動作確認をしながら進める
- serverだけでなくclient側も必要なUIを実装する
