import {
  type Card,
  CPU_THINKING_TIME_OPTIONS,
  GameState,
  Player,
} from "@dobon-uno/shared";
import { Dispatcher } from "./command";
import { ChooseColorCommand } from "./commands/ChooseColorCommand";
import { DobonCommand } from "./commands/DobonCommand";
import { DobonReturnCommand } from "./commands/DobonReturnCommand";
import { DrawCardCommand } from "./commands/DrawCardCommand";
import { DrawStackCommand } from "./commands/DrawStackCommand";
import { PassCommand } from "./commands/PassCommand";
import { PlayCardCommand } from "./commands/PlayCardCommand";
import { SkipDobonCommand } from "./commands/SkipDobonCommand";
import { StartGameCommand } from "./commands/StartGameCommand";
import { CPUPlayerService } from "./cpu/CPUPlayerService";
import { GameLog } from "./cpu/GameLog";
import type { Clock, GameHost } from "./GameHost";
import { PlayerActionUpdater } from "./services/PlayerActionUpdater";
import { TurnTimerService } from "./services/TurnTimerService";
import { createDeck, shuffleDeck } from "./utils/deck";

/**
 * 山札を生成する関数の型
 * テスト時にモックを注入するために使用
 */
export type DeckProvider = () => Card[];

/**
 * デフォルトのDeckProvider（本番用）
 * 山札を生成してシャッフルする
 */
export const defaultDeckProvider: DeckProvider = () =>
  shuffleDeck(createDeck());

export interface GameEngineOptions {
  clock: Clock;
  broadcast: (type: string, message: unknown) => void;
  deckProvider?: DeckProvider;
}

/**
 * ゲームの状態と進行を持つ本体
 * サーバーのGameRoomとブラウザ内のシングルプレイの両方から使う
 */
export class GameEngine implements GameHost {
  state = new GameState();
  dispatcher: Dispatcher = new Dispatcher(this);
  clock: Clock;

  // 山札（プレイヤーには同期しない）
  deck: Card[] = [];

  // 山札生成関数（DI可能）
  private deckProvider: DeckProvider;

  turnTimerService = new TurnTimerService(this.state);

  // 全員に見えている行動の履歴（CPUの推論に使う）
  gameLog = new GameLog();

  private cpuService = new CPUPlayerService(this.gameLog);

  private readonly broadcastHandler: GameEngineOptions["broadcast"];

  constructor(options: GameEngineOptions) {
    this.clock = options.clock;
    this.broadcastHandler = options.broadcast;
    this.deckProvider = options.deckProvider ?? defaultDeckProvider;
  }

  broadcast(type: string, message: unknown): void {
    this.broadcastHandler(type, message);
  }

  /**
   * プレイヤーからのゲーム操作を実行する
   * @returns 扱ったメッセージなら true
   */
  handleAction(sessionId: string, type: string, message?: unknown): boolean {
    switch (type) {
      // カードを出す（重ね出し対応）
      case "playCard":
        this.dispatcher.dispatch(new PlayCardCommand(), {
          sessionId,
          cardIds: (message as { cardIds: string[] }).cardIds,
        });
        return true;
      // 山札を引く
      case "drawCard":
        this.dispatcher.dispatch(new DrawCardCommand(), { sessionId });
        return true;
      // 累積カードを引く
      case "drawStack":
        this.dispatcher.dispatch(new DrawStackCommand(), { sessionId });
        return true;
      // パス
      case "pass":
        this.dispatcher.dispatch(new PassCommand(), { sessionId });
        return true;
      // ドボン
      case "dobon":
        this.dispatcher.dispatch(new DobonCommand(), { sessionId });
        return true;
      // ドボンしない
      case "skipDobon":
        this.dispatcher.dispatch(new SkipDobonCommand(), { sessionId });
        return true;
      // ドボン返し
      case "dobonReturn":
        this.dispatcher.dispatch(new DobonReturnCommand(), { sessionId });
        return true;
      // 色を選択
      case "chooseColor":
        this.dispatcher.dispatch(new ChooseColorCommand(), {
          sessionId,
          color: message as string,
        });
        return true;
      // ゲーム開始
      case "startGame":
        this.dispatcher.dispatch(new StartGameCommand(), {
          sessionId,
          startPlayerId: this.state.nextGameStartPlayerId || undefined,
          rateMultiplier: this.state.rateMultiplier,
        });
        return true;
      // ゲーム全体設定を更新
      case "updateGameSettings":
        this.updateGameSettings(
          sessionId,
          message as {
            showTotalPoints?: boolean;
            highlightPlayableCards?: boolean;
            cpuThinkingTime?: number;
          },
        );
        return true;
      default:
        return false;
    }
  }

  /**
   * ゲーム全体設定を更新する（ホストのみ）
   */
  private updateGameSettings(
    sessionId: string,
    message: {
      showTotalPoints?: boolean;
      highlightPlayableCards?: boolean;
      cpuThinkingTime?: number;
    },
  ) {
    const player = this.state.players.get(sessionId);
    if (!player?.isOwner) return;

    if (typeof message.showTotalPoints === "boolean") {
      this.state.showTotalPoints = message.showTotalPoints;
    }
    if (typeof message.highlightPlayableCards === "boolean") {
      this.state.highlightPlayableCards = message.highlightPlayableCards;
    }
    if (CPU_THINKING_TIME_OPTIONS.some((t) => t === message.cpuThinkingTime)) {
      this.state.cpuThinkingTime = message.cpuThinkingTime as number;
    }
  }

  /**
   * 山札を生成する（DeckProviderを使用）
   */
  createDeck(): Card[] {
    return this.deckProvider();
  }

  /**
   * DeckProviderを設定する（テスト用）
   */
  setDeckProvider(provider: DeckProvider) {
    this.deckProvider = provider;
  }

  /**
   * 全プレイヤーのアクション可否を更新する（テスト用）
   */
  updateAllPlayerActions() {
    // 色が未決定（最初のカードがwild/draw4で引いた場合等）なら何でも出せる
    const isColorNotSet = this.state.currentColor === "";
    const actionUpdater = new PlayerActionUpdater(this.state);
    actionUpdater.update({ isFirstCardWild: isColorNotSet });
  }

  /**
   * CPUプレイヤーを追加する
   */
  addCPUPlayer(name: string, seatId: number): void {
    const sessionId = `cpu-${crypto.randomUUID()}`;
    const player = new Player();
    player.sessionId = sessionId;
    player.name = name;
    player.isCpu = true;
    player.seatId = seatId;
    this.state.players.set(sessionId, player);
  }

  /**
   * CPUターンをチェックして実行する
   * PlayerActionUpdater.update() 後に呼び出す
   */
  async checkCPUTurn(): Promise<void> {
    if (this.state.phase !== "playing") return;

    // CPUのドボン・ドボン返しの判断（手番かどうかに関わらない）
    let isWaitingForDobonReturn = false;
    for (const player of this.state.players.values()) {
      if (player.canDobonReturn) isWaitingForDobonReturn = true;
      if (player.isCpu && (player.canDobon || player.canDobonReturn)) {
        void this.cpuService.handleDobonDecision(
          this.state,
          player,
          this.dispatcher,
        );
      }
    }

    // ドボン待ち・ドボン返し待ちの間はゲームを進めない
    if (this.state.waitingForDobon || isWaitingForDobonReturn) return;

    // 手番でないCPUのカットインの判断
    for (const player of this.state.players.values()) {
      if (player.isCpu && player.sessionId !== this.state.currentTurnPlayerId) {
        void this.cpuService.handleCutIn(this.state, player, this.dispatcher);
      }
    }

    const currentPlayer = this.state.players.get(
      this.state.currentTurnPlayerId,
    );

    if (currentPlayer?.isCpu) {
      await this.cpuService.handleTurn(
        this.state,
        currentPlayer,
        this.dispatcher,
      );
    }
  }

  /**
   * ゲーム状態をリセットする（次のゲーム開始前の状態に戻す）
   * NormalFinishCommand、DobonCommand、DobonReturnCommand、DeckOutCommandから呼び出される
   */
  resetGameState() {
    resetGameState(this);
  }

  /**
   * タイマーとコマンドの実行を止める（破棄するとき）
   */
  stop() {
    this.turnTimerService.stopAllTimers();
    this.dispatcher.stop();
  }
}

/**
 * ゲーム状態をリセットする（次のゲーム開始前の状態に戻す）
 */
export function resetGameState(
  host: Pick<GameHost, "state" | "gameLog"> & {
    deck: Card[];
  },
) {
  const state = host.state;

  // プレイヤー状態のリセット
  for (const player of state.players.values()) {
    // 手札をクリア
    player.myHand.splice(0, player.myHand.length);
    player.handCount = 0;
    player.revealedHand.splice(0, player.revealedHand.length);

    // アクションフラグをリセット
    player.canPass = false;
    player.canDraw = false;
    player.canChooseColor = false;
    player.canDobon = false;
    player.canDobonReturn = false;
    player.canDrawStack = false;
    player.playableCards.clear();
    player.timeRemaining = 0;
    player.drewCardSinceLastPlay = false;
    player.declinedDobon = false;
  }

  // ゲーム状態のリセット
  state.fieldCards.splice(0, state.fieldCards.length);
  state.discardPile.splice(0, state.discardPile.length);
  state.deckCount = 0;
  state.currentColor = "";
  state.currentTurnPlayerId = "";
  state.turnDirection = 1;
  state.drawStack = 0;
  state.waitingForColorChoice = false;
  state.hasDrawnThisTurn = false;
  state.lastPlayedCount = 1;
  state.firstCard = null;
  state.dealingRound = 0;
  state.countdown = 0;

  // ドボン状態のリセット
  state.dobonTargetId = "";
  state.dobonPlayerIds.splice(0, state.dobonPlayerIds.length);
  state.waitingForDobon = false;

  // 山札をクリア
  host.deck = [];

  // 行動履歴をクリア
  host.gameLog.reset();
}
