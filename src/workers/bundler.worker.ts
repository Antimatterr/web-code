/// <reference lib="webworker" />
/**
 * Bundler worker.
 *
 * Runs esbuild-wasm off the main thread. Each request carries a snapshot of
 * the project files; the vfs plugin resolves and loads modules from that
 * snapshot, and bare imports are left external for the preview's import map.
 */
import esbuild, { type Message } from "esbuild-wasm/esm/browser";
import wasmURL from "esbuild-wasm/esbuild.wasm?url";
import type { BundleMessage, BundleRequest, BundleResponse } from "../bundler/types";
import { VFS_NAMESPACE, vfsPlugin } from "../bundler/vfsPlugin";

let initPromise: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  // Cache the promise, not a boolean, so concurrent first requests share one
  // initialize() call instead of racing (esbuild throws on double init).
  if (!initPromise) {
    initPromise = esbuild.initialize({ wasmURL, worker: false }).catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

/** Convert esbuild's message shape into a plain, structured-clone-safe one. */
function toBundleMessage(m: Message): BundleMessage {
  const loc = m.location;
  const out: BundleMessage = { text: m.text };
  if (loc) {
    // Files in our namespace are reported as "vfs:/src/App.tsx".
    out.file = loc.file.startsWith(VFS_NAMESPACE + ":")
      ? loc.file.slice(VFS_NAMESPACE.length + 1)
      : loc.file;
    out.line = loc.line;
    out.column = loc.column + 1; // esbuild columns are 0-based; editors are 1-based
    out.lineText = loc.lineText;
  }
  return out;
}

function isBuildFailure(err: unknown): err is { errors: Message[]; warnings: Message[] } {
  return typeof err === "object" && err !== null && Array.isArray((err as { errors?: unknown }).errors);
}

self.onmessage = async (e: MessageEvent<BundleRequest>) => {
  const { id, entry, files } = e.data;

  const respond = (msg: BundleResponse) => self.postMessage(msg);

  try {
    await ensureInitialized();

    if (!Object.prototype.hasOwnProperty.call(files, entry)) {
      respond({
        id,
        ok: false,
        errors: [{ text: `Entry file "${entry}" does not exist.` }],
      });
      return;
    }

    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: "esm",
      target: "es2020",
      platform: "browser",
      jsx: "automatic",
      jsxImportSource: "react",
      sourcemap: false,
      logLevel: "silent",
      plugins: [vfsPlugin(files)],
    });

    const js = result.outputFiles.find((f) => f.path.endsWith(".js")) ?? result.outputFiles[0];
    respond({
      id,
      ok: true,
      code: js?.text ?? "",
      warnings: result.warnings.map(toBundleMessage),
    });
  } catch (err: unknown) {
    if (isBuildFailure(err)) {
      respond({ id, ok: false, errors: err.errors.map(toBundleMessage) });
      return;
    }
    const text = err instanceof Error ? err.message : "Bundle failed";
    respond({ id, ok: false, errors: [{ text }] });
  }
};
