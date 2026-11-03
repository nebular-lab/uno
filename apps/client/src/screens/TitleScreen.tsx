import { Button, Input, TutorialVideoDialog } from "@dobon-uno/game-ui";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { navigateToLobbyAtom, setPlayerNameAtom } from "../atoms/appAtoms";

const MAX_NAME_LENGTH = 8;

export function TitleScreen() {
  const setPlayerName = useSetAtom(setPlayerNameAtom);
  const navigateToLobby = useSetAtom(navigateToLobbyAtom);
  const [inputName, setInputName] = useState("");
  const [showTutorial, setShowTutorial] = useState(false);

  const handleStart = () => {
    const trimmedName = inputName.trim();
    if (trimmedName.length === 0 || trimmedName.length > MAX_NAME_LENGTH) {
      return;
    }
    setPlayerName(trimmedName);
    navigateToLobby();
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
        <p className="mt-2 text-2xl font-bold tracking-widest text-slate-300">
          マルチプレイ
        </p>
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
            disabled={!isValid}
            onClick={handleStart}
          >
            ロビーへ
          </Button>
        </div>
      </div>

      <Button
        className="mt-6 w-60 text-base h-12 bg-slate-700 hover:bg-slate-600 border-0 font-medium shadow transition-all hover:scale-[1.02] text-slate-200"
        onClick={() => setShowTutorial(true)}
      >
        ルール説明動画
      </Button>

      <TutorialVideoDialog onOpenChange={setShowTutorial} open={showTutorial} />
    </div>
  );
}
