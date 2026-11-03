import type { GameState, Player } from "@dobon-uno/shared";
import type { ActionDecider, CPUDecision } from "../ActionDecider";
import { fallbackDecision } from "../executeDecision";

/**
 * 比較用の単純なCPU。出せるカードがあれば先頭から出し、なければ引く。
 */
export class SimpleActionDecider implements ActionDecider {
  async decide(_state: GameState, player: Player): Promise<CPUDecision> {
    const decision = fallbackDecision(player);
    if (!decision) throw new Error("No available CPU action");
    return decision;
  }
}
