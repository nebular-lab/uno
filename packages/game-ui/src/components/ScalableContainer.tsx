import type React from "react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface ScalableContainerProps {
  children: ReactNode;
}

// 横画面前提の固定値
const BASE_WIDTH = 1250;
const ASPECT_RATIO = 19 / 9;
const BASE_HEIGHT = BASE_WIDTH / ASPECT_RATIO;

// Context for portal and scale
interface ScalableContainerContextValue {
  portalContainer: HTMLDivElement | null;
  scale: number;
}

const ScalableContainerContext = createContext<ScalableContainerContextValue>({
  portalContainer: null,
  scale: 1,
});

export const useScalableContainer = () => useContext(ScalableContainerContext);

export const ScalableContainer: React.FC<ScalableContainerProps> = ({
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scaledContentRef = useRef<HTMLDivElement>(null);
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
    <ScalableContainerContext.Provider
      value={{ portalContainer: scaledContentRef.current, scale }}
    >
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
              ref={scaledContentRef}
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
    </ScalableContainerContext.Provider>
  );
};
