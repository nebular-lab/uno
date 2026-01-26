import { useSetAtom } from "jotai";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { navigateToLobbyAtom, setPlayerNameAtom } from "../atoms/appAtoms";

const MAX_NAME_LENGTH = 8;

export function TitleScreen() {
  const setPlayerName = useSetAtom(setPlayerNameAtom);
  const navigateToLobby = useSetAtom(navigateToLobbyAtom);
  const [inputName, setInputName] = useState("");

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
      <div className="mb-12 text-center">
        <h1 className="text-7xl font-black tracking-wider text-white drop-shadow-lg">
          ドボンUNO
        </h1>
        <p className="text-slate-400 mt-2 text-sm tracking-widest">CARD GAME</p>
      </div>

      {/* 入力フォーム */}
      <div className="flex flex-col gap-5 w-96 bg-slate-800/50 p-8 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col gap-2">
          <label
            className="text-slate-300 text-sm font-medium"
            htmlFor="player-name"
          >
            プレイヤー名
          </label>
          <Input
            className="text-xl h-14 bg-slate-900/50 border-slate-600 focus:border-yellow-500 transition-colors"
            id="player-name"
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setInputName(e.target.value)}
            placeholder={`名前を入力（最大${MAX_NAME_LENGTH}文字）`}
            value={inputName}
          />
        </div>
        <Button
          className="text-xl h-14 mt-2 bg-blue-600 hover:bg-blue-500 border-0 font-bold tracking-wider shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 text-white"
          disabled={!isValid}
          onClick={handleStart}
        >
          START GAME
        </Button>
      </div>

      {/* フッター */}
      <p className="absolute bottom-4 text-slate-600 text-xs">v1.0</p>
    </div>
  );
}
