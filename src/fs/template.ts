/** Starter project seeded into an empty workspace. */

export const ENTRY_FILE = "/src/main.tsx";

export const DEFAULT_PROJECT: Record<string, string> = {
  "/src/main.tsx": `import App from './App'

// The preview mounts the default export of this file.
export default App
`,
  "/src/App.tsx": `import { useState } from 'react'
import Counter from './components/Counter'
import { formatCount } from './utils/format'

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: 32, fontFamily: 'system-ui' }}>
      <h1>Multi-file playground</h1>
      <p>{formatCount(count)}</p>
      <Counter value={count} onChange={setCount} />
    </div>
  )
}
`,
  "/src/components/Counter.tsx": `interface CounterProps {
  value: number
  onChange: (next: number) => void
}

export default function Counter({ value, onChange }: CounterProps) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={() => onChange(value - 1)}>-</button>
      <button onClick={() => onChange(value + 1)}>+</button>
    </div>
  )
}
`,
  "/src/utils/format.ts": `export function formatCount(n: number): string {
  return n === 1 ? '1 click' : \`\${n} clicks\`
}
`,
};
