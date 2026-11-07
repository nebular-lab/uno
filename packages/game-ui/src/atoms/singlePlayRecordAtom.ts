import { atom } from "jotai";

// シングルプレイ1ゲーム分の自分の成績
export type SinglePlayRecord = {
  timestamp: number; // ゲーム終了時刻（ミリ秒）
  scoreChange: number; // 自分の収支
  rateMultiplier: number; // このゲームのレート倍率
  finishType: string; // "normal" | "dobon" | "dobonReturn" | "deckOut"（流局）
  isWinner: boolean; // 自分が上がった（ドボンした）か
};

// 1ゲームでの自分の結果
// agari: 上がった / dobon: ドボンした（ドボン返し・最初の場札へのドボンを含む）
// doboned: ドボンされた（ドボン返しされたを含む） / none: それ以外
export type SinglePlayOutcome = "agari" | "dobon" | "doboned" | "none";

/**
 * 終わり方と自分の収支から、自分の結果を推定する
 * ドボン・ドボン返しで終わったゲームは、収支がプラスならドボンした、マイナスならドボンされた
 * （最初の場札へのドボンで支払っただけの場合も、ドボンされたとみなしてしまう）
 */
export const getSinglePlayOutcome = (
  record: SinglePlayRecord,
): SinglePlayOutcome => {
  if (record.finishType === "normal") {
    return record.isWinner ? "agari" : "none";
  }
  if (record.finishType === "dobon" || record.finishType === "dobonReturn") {
    if (record.scoreChange > 0) return "dobon";
    if (record.scoreChange < 0) return "doboned";
  }
  return "none";
};

const STORAGE_KEY = "dobon-uno-single-play-records";

const loadRecords = (): SinglePlayRecord[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
};

const saveRecords = (records: SinglePlayRecord[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
};

const baseAtom = atom<SinglePlayRecord[]>(loadRecords());

// 古い順に並んだ成績
export const singlePlayRecordsAtom = atom((get) => get(baseAtom));

export const addSinglePlayRecordAtom = atom(
  null,
  (_get, set, record: SinglePlayRecord) => {
    set(baseAtom, (prev) => {
      const next = [...prev, record];
      saveRecords(next);
      return next;
    });
  },
);
