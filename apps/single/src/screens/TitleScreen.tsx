import {
  Button,
  Dialog,
  DialogContent,
  RuleBook,
  SinglePlayRecordDialog,
} from "@dobon-uno/game-ui";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { startSinglePlayAtom } from "../atoms/singlePlayAtoms";

export function TitleScreen() {
  const startSinglePlay = useSetAtom(startSinglePlayAtom);
  const [showRecord, setShowRecord] = useState(false);
  const [showRuleBook, setShowRuleBook] = useState(false);

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
          シングルプレイ
        </p>
      </div>

      <div className="flex w-80 flex-col gap-4 bg-slate-800/50 p-7 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-sm">
        <p className="text-sm text-slate-400">CPU 4人と対戦</p>
        <div className="flex flex-col gap-3">
          <Button
            className="text-xl h-16 bg-emerald-600 hover:bg-emerald-500 border-0 font-bold shadow-lg transition-all hover:scale-[1.02] text-white"
            onClick={startSinglePlay}
          >
            はじめる
          </Button>
          <Button
            className="text-base h-12 bg-slate-700 hover:bg-slate-600 border-0 font-medium shadow transition-all hover:scale-[1.02] text-slate-200"
            onClick={() => setShowRecord(true)}
          >
            成績を見る
          </Button>
          <Button
            className="text-base h-12 bg-slate-700 hover:bg-slate-600 border-0 font-medium shadow transition-all hover:scale-[1.02] text-slate-200"
            onClick={() => setShowRuleBook(true)}
          >
            ルール
          </Button>
        </div>
      </div>

      <SinglePlayRecordDialog onOpenChange={setShowRecord} open={showRecord} />

      <Dialog onOpenChange={setShowRuleBook} open={showRuleBook}>
        <DialogContent className="max-w-[480px] h-[520px] p-0 overflow-hidden">
          <RuleBook />
        </DialogContent>
      </Dialog>
    </div>
  );
}
