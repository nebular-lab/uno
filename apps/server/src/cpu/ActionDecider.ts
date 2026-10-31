import type { GameState, Player } from "@dobon-uno/shared";

export interface CPUDecision {
  action: string;
  params?: unknown;
}

// CPUの行動を決めるロジックの共通インターフェース
export interface ActionDecider {
  decide(state: GameState, cpuPlayer: Player): Promise<CPUDecision>;
}
