import { useCallback, useEffect } from "react";
import type { ScreenType } from "../types/screen";

interface UseBeforeUnloadOptions {
  currentScreen: ScreenType;
  onNavigateAway?: () => void;
}

export function useBeforeUnload({
  currentScreen,
  onNavigateAway,
}: UseBeforeUnloadOptions) {
  const isProtected = currentScreen !== "title";

  // beforeunload（リロード、タブ閉じ）
  const handleBeforeUnload = useCallback(
    (event: BeforeUnloadEvent) => {
      if (!isProtected) return;
      event.preventDefault();
      event.returnValue = "";
    },
    [isProtected],
  );

  // popstate（戻るボタン）
  const handlePopState = useCallback(() => {
    if (!isProtected) return;
    const shouldLeave = window.confirm(
      "ページを離れると、現在の進行状況が失われます。\n本当に離れますか？",
    );
    if (shouldLeave) {
      onNavigateAway?.();
    } else {
      window.history.pushState(null, "", window.location.href);
    }
  }, [isProtected, onNavigateAway]);

  useEffect(() => {
    if (!isProtected) return;

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    window.history.pushState(null, "", window.location.href);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isProtected, handleBeforeUnload, handlePopState]);
}
