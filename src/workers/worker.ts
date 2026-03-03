/// <reference lib="webworker" />

import esbuild from "esbuild-wasm/esm/browser";
import wasmURL from "esbuild-wasm/esbuild.wasm?url";

let initialized = false;

const initializeEsbuild = async () => {
  if (initialized) {
    return;
  }

  await esbuild.initialize({
    wasmURL,
    worker: false,
  });

  initialized = true;
};

export interface TranspileRequest {
  id: string;
  code: string;
}

export interface TranspileResponse {
  id: string;
  code?: string;
  error?: string;
}

self.onmessage = async (e: MessageEvent<TranspileRequest>) => {
  const { id, code } = e.data;

  try {
    await initializeEsbuild();
    const result = await esbuild.transform(code, {
      loader: "tsx",
      format: "esm",
      target: "es2020",
      jsx: "automatic",
      jsxImportSource: "react",
    });

    self.postMessage({ id, code: result.code } satisfies TranspileResponse);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Transpile failed";
    self.postMessage({ id, error: message } satisfies TranspileResponse);
  }
};
