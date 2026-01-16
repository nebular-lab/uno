import { useSetAtom } from "jotai";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { navigateToLobbyAtom, setPlayerNameAtom } from "../atoms/appAtoms";

export function TitleScreen() {
  const setPlayerName = useSetAtom(setPlayerNameAtom);
  const navigateToLobby = useSetAtom(navigateToLobbyAtom);
  const [inputName, setInputName] = useState("");

  const handleStart = () => {
    const trimmedName = inputName.trim();
    if (trimmedName.length === 0 || trimmedName.length > 20) {
      return;
    }
    setPlayerName(trimmedName);
    navigateToLobby();
  };

  const isValid = inputName.trim().length > 0 && inputName.trim().length <= 20;

  return (
    <div className="h-full flex flex-col items-center justify-center bg-card text-foreground">
      <h1 className="text-6xl font-bold mb-16">ドボンUNO</h1>
      <div className="flex flex-col gap-4 w-80">
        <Input
          className="text-lg"
          maxLength={20}
          onChange={(e) => setInputName(e.target.value)}
          placeholder="名前を入力（最大20文字）"
          value={inputName}
        />
        <Button
          className="text-lg py-6"
          disabled={!isValid}
          onClick={handleStart}
          variant="outline"
        >
          Start
        </Button>
      </div>
    </div>
  );
}
