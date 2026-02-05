import { atom } from "jotai";
import type { ClientCard } from "@/types/connection";

/**
 * カード出しアニメーションの状態
 */
export interface CardAnimation {
  id: string; // アニメーションID（ユニーク）
  type: "playCard";
  playerId: string;
  seatId: number;
  cards: ClientCard[];
  isSelf: boolean; // 自分が出したカードかどうか
  startTime: number;
  duration: number;
  // アニメーション開始位置とサイズのスナップショット（カード削除前に取得）
  startPosition: { x: number; y: number; width: number; height: number } | null;
}

/**
 * カードドローアニメーションの状態
 */
export interface DrawCardAnimation {
  id: string; // アニメーションID（ユニーク）
  playerId: string;
  seatId: number;
  cardCount: number;
  startTime: number;
  duration: number;
  // アニメーション開始位置のスナップショット（山札位置）
  startPosition: { x: number; y: number } | null;
  // アニメーション終了位置のスナップショット（プレイヤーシート位置）
  endPosition: { x: number; y: number } | null;
}

// 現在再生中のアニメーション
export const currentAnimationAtom = atom<CardAnimation | null>(null);

// 現在再生中のドローアニメーション
export const currentDrawAnimationAtom = atom<DrawCardAnimation | null>(null);

// アニメーション中かどうか
export const isAnimatingAtom = atom(
  (get) => get(currentAnimationAtom) !== null,
);
