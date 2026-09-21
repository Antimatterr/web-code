/// <reference lib="webworker" />
/// <reference lib="webworker.asynciterable" />
/**
 * OPFS worker.
 *
 * All durable file I/O happens here using FileSystemSyncAccessHandle, which is
 * (a) only available in workers, (b) supported by Chrome, Firefox and Safari,
 * unlike createWritable() which Safari lacks, and (c) fast, because it avoids
 * the per-write stream setup cost.
 *
 * Paths are project-absolute ("/src/App.tsx") and mapped under a "project"
 * directory in the origin's private filesystem.
 */
import type { FsRequest, FsResponse, ReadAllResult } from "../fs/opfsProtocol";

const PROJECT_DIR = "project";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let rootPromise: Promise<FileSystemDirectoryHandle> | null = null;

function projectRoot(): Promise<FileSystemDirectoryHandle> {
  if (!rootPromise) {
    rootPromise = navigator.storage
      .getDirectory()
      .then((root) => root.getDirectoryHandle(PROJECT_DIR, { create: true }));
  }
  return rootPromise;
}

function segments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

async function getDir(parts: string[], create: boolean): Promise<FileSystemDirectoryHandle> {
  let dir = await projectRoot();
  for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
  return dir;
}

/**
 * Sync access handles are exclusive per file. If another tab briefly holds
 * one, acquisition throws; retry a few times before giving up.
 */
async function withAccessHandle<T>(
  file: FileSystemFileHandle,
  fn: (h: FileSystemSyncAccessHandle) => T,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const handle = await file.createSyncAccessHandle();
      try {
        return fn(handle);
      } finally {
        handle.close();
      }
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function readFile(file: FileSystemFileHandle): Promise<string> {
  return withAccessHandle(file, (h) => {
    const buf = new Uint8Array(h.getSize());
    h.read(buf, { at: 0 });
    return decoder.decode(buf);
  });
}

async function writeFile(path: string, content: string): Promise<void> {
  const parts = segments(path);
  const name = parts.pop()!;
  const dir = await getDir(parts, true);
  const file = await dir.getFileHandle(name, { create: true });
  const bytes = encoder.encode(content);
  await withAccessHandle(file, (h) => {
    h.truncate(0);
    h.write(bytes, { at: 0 });
    h.flush();
  });
}

async function mkdir(path: string): Promise<void> {
  await getDir(segments(path), true);
}

async function remove(path: string): Promise<void> {
  const parts = segments(path);
  const name = parts.pop()!;
  const dir = await getDir(parts, false);
  await dir.removeEntry(name, { recursive: true });
}

async function walk(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  out: ReadAllResult,
): Promise<void> {
  for await (const [name, handle] of dir.entries()) {
    const path = `${prefix}/${name}`;
    if (handle.kind === "directory") {
      out.dirs.push(path);
      await walk(handle as FileSystemDirectoryHandle, path, out);
    } else {
      out.files[path] = await readFile(handle as FileSystemFileHandle);
    }
  }
}

async function readAll(): Promise<ReadAllResult> {
  const out: ReadAllResult = { files: {}, dirs: [] };
  await walk(await projectRoot(), "", out);
  return out;
}

async function rename(from: string, to: string): Promise<void> {
  // OPFS has no portable move; copy then delete. Directories are walked so
  // nested files land under the new prefix.
  const fromParts = segments(from);
  const name = fromParts.pop()!;
  const parent = await getDir(fromParts, false);

  let isFile = true;
  try {
    await parent.getFileHandle(name);
  } catch {
    isFile = false;
  }

  if (isFile) {
    const content = await readFile(await parent.getFileHandle(name));
    await writeFile(to, content);
  } else {
    const sub = await parent.getDirectoryHandle(name);
    const snapshot: ReadAllResult = { files: {}, dirs: [] };
    await walk(sub, "", snapshot);
    await mkdir(to);
    for (const d of snapshot.dirs) await mkdir(to + d);
    for (const [p, c] of Object.entries(snapshot.files)) await writeFile(to + p, c);
  }
  await remove(from);
}

async function clear(): Promise<void> {
  const root = await navigator.storage.getDirectory();
  await root.removeEntry(PROJECT_DIR, { recursive: true });
  rootPromise = null;
}

self.onmessage = async (e: MessageEvent<FsRequest>) => {
  const req = e.data;
  const reply = (msg: FsResponse) => self.postMessage(msg);
  try {
    switch (req.op) {
      case "readAll":
        reply({ id: req.id, ok: true, result: await readAll() });
        break;
      case "write":
        await writeFile(req.path, req.content);
        reply({ id: req.id, ok: true });
        break;
      case "mkdir":
        await mkdir(req.path);
        reply({ id: req.id, ok: true });
        break;
      case "delete":
        await remove(req.path);
        reply({ id: req.id, ok: true });
        break;
      case "rename":
        await rename(req.from, req.to);
        reply({ id: req.id, ok: true });
        break;
      case "clear":
        await clear();
        reply({ id: req.id, ok: true });
        break;
    }
  } catch (err) {
    reply({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
