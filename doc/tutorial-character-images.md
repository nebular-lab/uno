# チュートリアル キャラクター画像一覧

配置先: `apps/client/public/tutorial/characters/`

## まりさ（6枚）

各表情 × 口閉じ・口開きの2枚ずつ。口の開閉はセリフ中に自動で切り替わる。

| ファイル名 | 表情 | 口 | 使用場面 |
|---|---|---|---|
| `marisa_normal_close.png` | 通常 | 閉じ | ルール説明など大半のセリフ |
| `marisa_normal_open.png` | 通常 | 開き | 同上（発話中） |
| `marisa_smile_close.png` | 笑顔 | 閉じ | 「覚えなくても大丈夫だぜ」「カウンターが決まったぜ」等 |
| `marisa_smile_open.png` | 笑顔 | 開き | 同上（発話中） |
| `marisa_smug_close.png` | ドヤ顔 | 閉じ | 「ドボンできるんだ」「ドボン返しできる」等、得意げなとき |
| `marisa_smug_open.png` | ドヤ顔 | 開き | 同上（発話中） |

## 霊夢（6枚）

| ファイル名 | 表情 | 口 | 使用場面 |
|---|---|---|---|
| `reimu_normal_close.png` | 通常 | 閉じ | 普通に聞いている・話しているとき（大半のセリフ） |
| `reimu_normal_open.png` | 通常 | 開き | 同上（発話中） |
| `reimu_surprise_close.png` | 驚き | 閉じ | 「80点も取られちゃうのか」「大きなマイナスになるね」等 |
| `reimu_surprise_open.png` | 驚き | 開き | 同上（発話中） |
| `reimu_impressed_close.png` | 感心 | 閉じ | 「ドボンできるんだね」「ノーリスクで切れるんだね」等、理解・納得したとき |
| `reimu_impressed_open.png` | 感心 | 開き | 同上（発話中） |

---

合計: 12枚（まりさ6枚 + 霊夢6枚）

## 画像仕様

- 形式: PNG（透過背景推奨）
- サイズ: 高さ250px程度（幅は立ち絵のアスペクト比に合わせて自由）
- 配置位置: 画面の左下（まりさ）、右下（霊夢）
- 発話していないキャラは暗く（brightness 0.7）表示される
