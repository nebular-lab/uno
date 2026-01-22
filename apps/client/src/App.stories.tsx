import type { Meta, StoryContext, StoryObj } from "@storybook/react-vite";
import { createStore, Provider } from "jotai";
import type { ReactNode } from "react";
import { useMemo } from "react";
import App from "./App";
import { playerAtom, screenAtom } from "./atoms/appAtoms";
import {
  gamePlayStateAtom,
  gameStateAtom,
  lobbyStateAtom,
} from "./atoms/connectionAtoms";
import type {
  ClientCard,
  ClientPlayer,
  GamePlayState,
} from "./types/connection";

// モック用のプレイヤーデータ
const createMockPlayer = (
  seatIndex: number,
  name: string,
  cardCount: number,
  isHost = false,
): ClientPlayer => ({
  seatIndex,
  name,
  cardCount,
  isHost,
  isReady: true,
  isSpectator: false,
});

// モック用のカードデータ
const createMockCard = (
  id: string,
  color: string,
  value: string,
  points = 0,
): ClientCard => ({
  id,
  color,
  value,
  points,
});

// ゲーム開始時点の手札
const mockMyHand: ClientCard[] = [
  createMockCard("card-1", "red", "3", 3),
  createMockCard("card-2", "blue", "7", 7),
  createMockCard("card-3", "green", "5", 5),
  createMockCard("card-4", "yellow", "2", 2),
  createMockCard("card-5", "red", "skip", 20),
  createMockCard("card-6", "blue", "9", 9),
  createMockCard("card-7", "green", "1", 1),
];

// ゲーム開始時点の場札
const mockFieldCards: ClientCard[] = [createMockCard("field-1", "red", "5", 5)];

// ゲーム開始時点のプレイヤー配置
const mockPlayers: (ClientPlayer | null)[] = [
  createMockPlayer(0, "Alice", 7, true), // ホスト
  createMockPlayer(1, "Bob", 7),
  createMockPlayer(2, "Charlie", 7),
  createMockPlayer(3, "自分", 7), // 自分（seat 3）
  createMockPlayer(4, "Eve", 7),
  null, // 空席
];

// ゲーム開始時点のゲームプレイ状態
const mockGamePlayState: GamePlayState = {
  players: mockPlayers,
  mySessionId: "my-session-id",
  isReady: true,
  myHand: mockMyHand,
  phase: "playing",
  dealingRound: 7,
  countdown: 0,
  fieldCards: mockFieldCards,
  currentTurnPlayerId: "alice-session-id",
  currentColor: "red",
  deckCount: 45,
};

// Storybook用のプロバイダーラッパー
type StoryProviderProps = {
  children: ReactNode;
  gamePlayState?: GamePlayState;
};

const StoryProvider = ({
  children,
  gamePlayState = mockGamePlayState,
}: StoryProviderProps) => {
  const store = useMemo(() => {
    const s = createStore();
    s.set(screenAtom, { screen: "game", roomId: "test-room-123" });
    s.set(playerAtom, { name: "自分" });
    s.set(lobbyStateAtom, { status: "idle" });
    s.set(gameStateAtom, { status: "idle" });
    s.set(gamePlayStateAtom, gamePlayState);
    return s;
  }, [gamePlayState]);

  return <Provider store={store}>{children}</Provider>;
};

// Storybook用のカスタムargs型
type StoryArgs = {
  gamePlayState?: GamePlayState;
};

const meta: Meta<typeof App> = {
  title: "Screens/App",
  component: App,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story, context: StoryContext<StoryArgs>) => (
      <StoryProvider gamePlayState={context.args.gamePlayState}>
        <Story />
      </StoryProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta> & { args?: StoryArgs };

// ゲーム開始時点の状態
export const GameStart: Story = {
  args: {
    gamePlayState: mockGamePlayState,
  },
};
