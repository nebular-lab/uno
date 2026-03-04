import { atom } from "jotai";

type PlayerSettings = {
  showCardPoints: boolean;
};

const STORAGE_KEY = "dobon-uno-player-settings";

const loadSettings = (): PlayerSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return { showCardPoints: false };
};

const baseAtom = atom<PlayerSettings>(loadSettings());

export const playerSettingsAtom = atom(
  (get) => get(baseAtom),
  (_get, set, update: Partial<PlayerSettings>) => {
    set(baseAtom, (prev) => {
      const next = { ...prev, ...update };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  },
);
