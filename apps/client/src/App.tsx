import { useState } from "react";
import viteLogo from "/vite.svg";
import reactLogo from "./assets/react.svg";
import { ScalableContainer } from "./components/ScalableContainer";

function App() {
  const [count, setCount] = useState(0);

  return (
    <ScalableContainer>
      <div className="h-full flex flex-col items-center justify-center bg-gray-900 text-white">
        <div className="flex gap-8 mb-8">
          <a
            className="transition hover:drop-shadow-[0_0_2em_#646cffaa]"
            href="https://vite.dev"
            rel="noopener"
            target="_blank"
          >
            <img alt="Vite logo" className="h-24 w-24" src={viteLogo} />
          </a>
          <a
            className="transition hover:drop-shadow-[0_0_2em_#61dafbaa]"
            href="https://react.dev"
            rel="noopener"
            target="_blank"
          >
            <img alt="React logo" className="h-24 w-24" src={reactLogo} />
          </a>
        </div>
        <h1 className="text-5xl font-bold mb-8">Vite + React</h1>
        <div className="p-8">
          <button
            className="px-6 py-3 bg-gray-800 rounded-lg border border-transparent font-medium transition hover:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/50"
            onClick={() => setCount((count) => count + 1)}
            type="button"
          >
            count is {count}
          </button>
          <p className="mt-4 text-gray-400">
            Edit{" "}
            <code className="bg-gray-800 px-2 py-1 rounded">src/App.tsx</code>{" "}
            and save to test HMR
          </p>
        </div>
        <p className="text-gray-500 text-sm">
          Click on the Vite and React logos to learn more
        </p>
      </div>
    </ScalableContainer>
  );
}

export default App;
