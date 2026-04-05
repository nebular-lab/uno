#!/bin/bash
# 音声ファイルの再生時間を取得し、script.tsで使えるJSON形式で出力する
# 使い方: bash scripts/get-voice-durations.sh

VOICE_DIR="apps/client/public/tutorial/voice"
FPS=30

echo "{"

first=true
for file in "$VOICE_DIR"/*.mp3; do
  filename=$(basename "$file")
  # afinfo で再生時間（秒）を取得
  duration=$(afinfo "$file" 2>/dev/null | grep "estimated duration" | awk '{print $3}')

  if [ -z "$duration" ]; then
    continue
  fi

  # フレーム数に変換（切り上げ + 余白15フレーム）
  frames=$(echo "$duration $FPS" | awk '{printf "%d", int($1 * $2 + 0.5) + 15}')

  if [ "$first" = true ]; then
    first=false
  else
    echo ","
  fi

  printf '  "%s": %s' "$filename" "$frames"
done

echo ""
echo "}"
