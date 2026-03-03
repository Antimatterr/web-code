import { useEffect, useRef } from "react";

function App() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("./workers/worker.ts", import.meta.url),
      { type: "module" },
    );

    workerRef.current.onmessage = (event) => {
      console.log("Result from worker:", event.data);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const handleClick = () => {
    workerRef.current?.postMessage({ number: 5 });
  };

  return (
    <div>
      <button onClick={handleClick}>Run Worker</button>
    </div>
  );
}

export default App;
