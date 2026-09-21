/**
 * Integration test: runs the real esbuild-wasm (Node build) with the vfs
 * plugin against an in-memory project, exactly as the worker does.
 */
import * as esbuild from "esbuild-wasm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { vfsPlugin } from "../vfsPlugin";

const files: Record<string, string> = {
  "/src/main.tsx": `import App from './App'\nexport default App\n`,
  "/src/App.tsx": `import { useState } from 'react'
import Counter from './components/Counter'
import { double } from '../lib/math'
import data from './data.json'
export default function App() {
  const [n] = useState(data.start)
  return <Counter value={double(n)} />
}`,
  "/src/components/Counter.tsx": `export default function Counter({ value }: { value: number }) {
  return <span>{value}</span>
}`,
  "/lib/math/index.ts": `export const double = (n: number) => n * 2`,
  "/src/data.json": `{ "start": 21 }`,
  "/src/styles.css": `body { margin: 0 }`,
};

async function bundle(entry: string, project = files) {
  return esbuild.build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "esm",
    target: "es2020",
    jsx: "automatic",
    jsxImportSource: "react",
    logLevel: "silent",
    // Node's esbuild-wasm typings and the browser typings are structurally
    // identical; the cast keeps the plugin importable from both.
    plugins: [vfsPlugin(project) as unknown as esbuild.Plugin],
  });
}

beforeAll(async () => {
  // esbuild-wasm's node entry spawns its own wasm; no explicit initialize.
}, 30_000);

afterAll(async () => {
  await esbuild.stop?.();
});

describe("vfsPlugin", () => {
  it("bundles a multi-file project and leaves bare imports external", async () => {
    const result = await bundle("/src/main.tsx");
    const code = result.outputFiles[0].text;

    // Local modules are inlined ...
    expect(code).toContain("n * 2");
    expect(code).toContain("Counter");
    expect(code).toContain("21");
    // ... while react stays an import for the iframe's import map.
    expect(code).toMatch(/from\s+"react"/);
    expect(code).toMatch(/from\s+"react\/jsx-runtime"/);
    expect(code).not.toContain("./App");
  }, 30_000);

  it("reports a missing module with the importer and location", async () => {
    const broken = { ...files, "/src/App.tsx": `import X from './Nope'\nexport default X` };
    await expect(bundle("/src/main.tsx", broken)).rejects.toMatchObject({
      errors: [
        expect.objectContaining({
          text: expect.stringContaining(`Cannot find module "./Nope" from "/src/App.tsx"`),
          location: expect.objectContaining({ file: "vfs:/src/App.tsx", line: 1 }),
        }),
      ],
    });
  }, 30_000);

  it("rejects file types it cannot load yet", async () => {
    const withCss = {
      ...files,
      "/src/main.tsx": `import './styles.css'\nimport App from './App'\nexport default App`,
    };
    await expect(bundle("/src/main.tsx", withCss)).rejects.toMatchObject({
      errors: [expect.objectContaining({ text: expect.stringContaining(".css") })],
    });
  }, 30_000);

  it("surfaces TypeScript syntax errors with a file and line", async () => {
    const bad = { ...files, "/src/components/Counter.tsx": `export default function (` };
    await expect(bundle("/src/main.tsx", bad)).rejects.toMatchObject({
      errors: [
        expect.objectContaining({
          location: expect.objectContaining({ file: "vfs:/src/components/Counter.tsx" }),
        }),
      ],
    });
  }, 30_000);
});
