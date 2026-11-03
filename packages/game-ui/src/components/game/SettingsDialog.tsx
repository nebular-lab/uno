import { CPU_THINKING_TIME_OPTIONS } from "@dobon-uno/shared";
import { useAtom } from "jotai";
import { playerSettingsAtom } from "../../atoms/playerSettingsAtom";
import { useGameRoom } from "../../hooks/useGameRoom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const Toggle = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label className="flex cursor-pointer items-center justify-between py-3">
    <span className="text-base text-white">{label}</span>
    <button
      className={`relative h-7 w-12 rounded-full transition-colors ${checked ? "bg-blue-500" : "bg-gray-600"}`}
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span
        className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  </label>
);

const SegmentedChoice = <T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) => (
  <div className="flex items-center justify-between py-3">
    <span className="text-base text-white">{label}</span>
    <div className="flex rounded-full bg-gray-600 p-0.5">
      {options.map((option) => (
        <button
          className={`rounded-full px-3 py-1 text-sm transition-colors ${option.value === value ? "bg-blue-500 text-white" : "text-slate-300"}`}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

const cpuThinkingTimeOptions = CPU_THINKING_TIME_OPTIONS.map((ms) => ({
  value: ms as number,
  label: `${ms / 1000}秒`,
}));

export const SettingsDialog = ({ open, onOpenChange }: Props) => {
  const [playerSettings, setPlayerSettings] = useAtom(playerSettingsAtom);
  const {
    isHost,
    showTotalPoints,
    highlightPlayableCards,
    cpuThinkingTime,
    updateGameSettings,
  } = useGameRoom();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="w-[420px] p-9">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-white">
            設定
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-1">
          <h3 className="text-sm font-medium text-slate-400">個人設定</h3>
          <Toggle
            checked={playerSettings.showCardPoints}
            label="カードにポイントを表示"
            onChange={(checked) =>
              setPlayerSettings({ showCardPoints: checked })
            }
          />
        </div>

        {isHost && (
          <div className="mt-6 space-y-1 border-t border-slate-600 pt-4">
            <h3 className="text-sm font-medium text-slate-400">
              ゲーム全体設定（ホスト）
            </h3>
            <p className="text-xs text-yellow-400">
              設定の変更がすぐにプレイヤー全員に反映されます。注意してください。
            </p>
            <Toggle
              checked={showTotalPoints}
              label="合計ポイントの表示"
              onChange={(checked) =>
                updateGameSettings({ showTotalPoints: checked })
              }
            />
            <Toggle
              checked={highlightPlayableCards}
              label="出せるカードのハイライト"
              onChange={(checked) =>
                updateGameSettings({ highlightPlayableCards: checked })
              }
            />
            <SegmentedChoice
              label="CPUの思考時間"
              onChange={(ms) => updateGameSettings({ cpuThinkingTime: ms })}
              options={cpuThinkingTimeOptions}
              value={cpuThinkingTime}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
