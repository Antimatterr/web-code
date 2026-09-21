/**
 * Workspace startup.
 *
 *  1. Detect OPFS. Without it the project lives in memory only.
 *  2. Take the "project writer" Web Lock. If another tab already holds it,
 *     this tab opens read-only: it still hydrates from disk but never writes,
 *     so two tabs cannot fight over the same files.
 *  3. Hydrate the store from disk, seeding the default template on first run.
 *  4. Start the persistence layer (writer tabs only).
 */
import { fileStore } from "./fileStore";
import { isOpfsSupported } from "./opfsAdapter";
import { persistence } from "./persistence";
import { DEFAULT_PROJECT } from "./template";

export type StorageMode = "opfs" | "read-only" | "memory";

export interface WorkspaceInfo {
  mode: StorageMode;
  /** Human-readable reason when not in full "opfs" mode. */
  note?: string;
}

const LOCK_NAME = "web-code:project-writer";

let bootPromise: Promise<WorkspaceInfo> | null = null;

/** Idempotent: React StrictMode may call this twice. */
export function initWorkspace(): Promise<WorkspaceInfo> {
  if (!bootPromise) bootPromise = boot();
  return bootPromise;
}

async function boot(): Promise<WorkspaceInfo> {
  if (!isOpfsSupported()) {
    fileStore.hydrate(DEFAULT_PROJECT);
    return {
      mode: "memory",
      note: "This browser has no Origin Private File System. Changes are not saved.",
    };
  }

  const isWriter = await acquireWriterLock();
  const adapter = persistence.adapter;

  const { files, dirs } = await adapter.readAll();
  const hasFiles = Object.keys(files).length > 0;

  if (hasFiles) {
    fileStore.hydrate(files, emptyDirsOnly(dirs, files));
  } else {
    fileStore.hydrate(DEFAULT_PROJECT);
    if (isWriter) {
      // Seed the template to disk so the next load finds it.
      for (const [path, content] of Object.entries(DEFAULT_PROJECT)) {
        await adapter.write(path, content);
      }
    }
  }

  if (!isWriter) {
    return {
      mode: "read-only",
      note: "Another tab is editing this project. This tab is read-only.",
    };
  }

  persistence.start();
  return { mode: "opfs" };
}

/**
 * Hold the writer lock for the lifetime of the tab. `navigator.locks.request`
 * keeps the lock as long as the callback's promise is pending, so we hand it
 * a promise that never resolves. `ifAvailable` makes it return null instead of
 * waiting when another tab owns the lock.
 */
function acquireWriterLock(): Promise<boolean> {
  if (typeof navigator.locks === "undefined") return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
      if (!lock) {
        resolve(false);
        return;
      }
      resolve(true);
      return new Promise<void>(() => {}); // hold forever
    });
  });
}

function emptyDirsOnly(dirs: string[], files: Record<string, string>): string[] {
  const paths = Object.keys(files);
  return dirs.filter((d) => !paths.some((p) => p.startsWith(d + "/")));
}
