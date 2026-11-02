import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { SinglePlayRecordDialog } from "@/components/SinglePlayRecordDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { navigateToLobbyAtom, setPlayerNameAtom } from "../atoms/appAtoms";
import {
  createSinglePlayRoomAtom,
  gameStateAtom,
} from "../atoms/connectionAtoms";

const MAX_NAME_LENGTH = 8;

export function TitleScreen() {
  const setPlayerName = useSetAtom(setPlayerNameAtom);
  const navigateToLobby = useSetAtom(navigateToLobbyAtom);
  const createSinglePlayRoom = useSetAtom(createSinglePlayRoomAtom);
  const gameState = useAtomValue(gameStateAtom);
  const [inputName, setInputName] = useState("");
  const [showTutorial, setShowTutorial] = useState(false);
  const [showRecord, setShowRecord] = useState(false);
  // この画面でシングルプレイを開始しようとしたか（他画面で起きたエラーを表示しないため）
  const [hasTriedSinglePlay, setHasTriedSinglePlay] = useState(false);

  const handleStart = () => {
    const trimmedName = inputName.trim();
    if (trimmedName.length === 0 || trimmedName.length > MAX_NAME_LENGTH) {
      return;
    }
    setPlayerName(trimmedName);
    navigateToLobby();
  };

  // シングルプレイの開始中・開始失敗
  const isStartingSinglePlay =
    hasTriedSinglePlay && gameState.status === "joining";
  const singlePlayError =
    hasTriedSinglePlay && gameState.status === "error" ? gameState.error : null;

  const handleStartSinglePlay = () => {
    setHasTriedSinglePlay(true);
    createSinglePlayRoom();
  };

  const isValid =
    inputName.trim().length > 0 && inputName.trim().length <= MAX_NAME_LENGTH;

  return (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 text-foreground relative overflow-hidden">
      {/* 背景の装飾カード */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-10 left-10 w-24 h-36 bg-white rounded-lg rotate-[-15deg]" />
        <div className="absolute top-20 right-20 w-24 h-36 bg-white rounded-lg rotate-[20deg]" />
        <div className="absolute bottom-20 left-1/4 w-24 h-36 bg-white rounded-lg rotate-[10deg]" />
        <div className="absolute bottom-10 right-1/3 w-24 h-36 bg-white rounded-lg rotate-[-10deg]" />
      </div>

      {/* タイトル */}
      <div className="mb-8 text-center">
        <h1 className="text-7xl font-black tracking-wider text-white drop-shadow-lg">
          ドボンUNO
        </h1>
      </div>

      <div className="flex items-stretch gap-6">
        {/* シングルプレイ */}
        <div className="flex w-80 flex-col gap-4 bg-slate-800/50 p-7 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-sm">
          <div>
            <h2 className="text-2xl font-bold text-white">シングルプレイ</h2>
            <p className="mt-1 text-sm text-slate-400">CPU 4人と対戦</p>
          </div>
          <div className="mt-auto flex flex-col gap-3">
            <Button
              className="text-xl h-16 bg-emerald-600 hover:bg-emerald-500 border-0 font-bold shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 text-white"
              disabled={isStartingSinglePlay}
              onClick={handleStartSinglePlay}
            >
              {isStartingSinglePlay ? <Spinner size="lg" /> : "はじめる"}
            </Button>
            <Button
              className="text-base h-12 bg-slate-700 hover:bg-slate-600 border-0 font-medium shadow transition-all hover:scale-[1.02] text-slate-200"
              onClick={() => setShowRecord(true)}
            >
              成績を見る
            </Button>
          </div>
          {singlePlayError && (
            <div className="p-2 text-sm bg-red-900/50 text-red-300 rounded-lg border border-red-700">
              {singlePlayError}
            </div>
          )}
        </div>

        {/* 友人戦 */}
        <div className="flex w-80 flex-col gap-4 bg-slate-800/50 p-7 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-sm">
          <div>
            <h2 className="text-2xl font-bold text-white">友人戦</h2>
            <p className="mt-1 text-sm text-slate-400">
              ルームを作って友人と対戦
            </p>
          </div>
          <div className="mt-auto flex flex-col gap-3">
            <Input
              aria-label="プレイヤー名"
              className="text-lg h-12 bg-slate-900/50 border-slate-600 focus:border-yellow-500 transition-colors"
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => setInputName(e.target.value)}
              placeholder={`名前を入力（最大${MAX_NAME_LENGTH}文字）`}
              value={inputName}
            />
            <Button
              className="text-xl h-16 bg-blue-600 hover:bg-blue-500 border-0 font-bold shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 text-white"
              disabled={!isValid || isStartingSinglePlay}
              onClick={handleStart}
            >
              ロビーへ
            </Button>
          </div>
        </div>
      </div>

      <Button
        className="mt-6 w-60 text-base h-12 bg-slate-700 hover:bg-slate-600 border-0 font-medium shadow transition-all hover:scale-[1.02] text-slate-200"
        onClick={() => setShowTutorial(true)}
      >
        ルール説明動画
      </Button>

      <SinglePlayRecordDialog onOpenChange={setShowRecord} open={showRecord} />

      <Dialog onOpenChange={setShowTutorial} open={showTutorial}>
        <DialogContent className="max-w-[1024px] p-4">
          {/* 動画は pnpm render:tutorial で書き出す */}
          {/* biome-ignore lint/a11y/useMediaCaption: 字幕は映像に焼き込み済み */}
          <video
            className="w-full max-w-[960px] aspect-video bg-black"
            controls
            playsInline
            preload="metadata"
            src="/tutorial/tutorial.mp4"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
