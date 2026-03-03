// src/pages/EditorPage.tsx
import { useState } from "react";
import { useTranspiler } from "../hooks/useTrasnpiler";
const SAMPLE = `
export default function App() {
  return <h1>Hello from JSX!</h1>
}
`;

export default function EditorPage() {
  const [code, setCode] = useState(SAMPLE);
  const { output, error, isCompiling } = useTranspiler(code);

  return (
    <div style={{ padding: 20, fontFamily: "monospace" }}>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={10}
        style={{ width: "100%", background: "#111", color: "#fff", padding: 8 }}
      />
      <p style={{ color: "grey" }}>{isCompiling ? "Compiling..." : ""}</p>
      {error && <pre style={{ color: "red" }}>{error}</pre>}
      {output && <pre style={{ color: "blue" }}>{output}</pre>}
    </div>
  );
}
