import { atom } from "jotai";
import type { PlayerInfo, ScreenState } from "../types/screen";

// 画面状態のatom
export const screenAtom = atom<ScreenState>({ screen: "title" });

// プレイヤー情報のatom
export const playerAtom = atom<PlayerInfo | null>(null);

// アクション用のwrite-only atoms
export const setPlayerNameAtom = atom(null, (_get, set, name: string) => {
  set(playerAtom, { name });
});

export const navigateToLobbyAtom = atom(null, (_get, set) => {
  set(screenAtom, { screen: "lobby" });
});

export const navigateToRoomAtom = atom(null, (_get, set, roomId: string) => {
  set(screenAtom, { screen: "room", roomId });
});

export const navigateToGameAtom = atom(null, (_get, set, roomId: string) => {
  set(screenAtom, { screen: "game", roomId });
});

export const navigateToTitleAtom = atom(null, (_get, set) => {
  set(screenAtom, { screen: "title" });
  set(playerAtom, null);
});
