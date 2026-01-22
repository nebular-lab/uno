import type React from "react";
import { type ReactNode, useEffect, useRef, useState } from "react";

interface ScalableContainerProps {
  children: ReactNode;
}

// 横画面前提の固定値
const BASE_WIDTH = 1250;
const ASPECT_RATIO = 19 / 9;
const BASE_HEIGHT = BASE_WIDTH / ASPECT_RATIO;

export const ScalableContainer: React.FC<ScalableContainerProps> = ({
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const { clientHeight: ch, clientWidth: cw } = containerRef.current;
        // 実際に利用可能な幅と高さでスケールを計算
        const availableWidth = cw;
        const availableHeight = ch;
        const s = Math.min(
          availableWidth / BASE_WIDTH,
          availableHeight / BASE_HEIGHT,
        );
        setScale(s);
        setIsInitialized(true);
      }
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return (
    <div
      className="flex h-dvh w-screen items-center justify-center"
      ref={containerRef}
    >
      {isInitialized && (
        <div
          className="relative bg-card"
          style={{
            width: BASE_WIDTH * scale,
            height: BASE_HEIGHT * scale,
          }}
        >
          <div
            className="relative overflow-auto"
            style={
              {
                width: BASE_WIDTH,
                height: BASE_HEIGHT,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                "--container-scale": scale,
              } as React.CSSProperties
            }
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
};
