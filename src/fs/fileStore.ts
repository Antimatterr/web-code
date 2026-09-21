/**
 * In-memory project filesystem.
 *
 * This is the synchronous source of truth for the editor UI and the bundler.
 * Persistence (OPFS) and Monaco model management subscribe to `onChange`
 * events and mirror what happens here; they never mutate the store on their
 * own except through `hydrate` and `markSaved`.
 *
 * Files are a flat map keyed by absolute path ("/src/App.tsx"). Folders exist
 * implicitly through file paths, plus an explicit set so that empty folders
 * created from the UI survive until a file is put inside them.
 */
import { dirname, isInside, normalizePath, validatePath } from "./pathUtils";

export type FileMap = ReadonlyMap<string, string>;

export interface FileStoreSnapshot {
  /** path -> content for every file in the project. */
  readonly files: FileMap;
  /** Folders that exist explicitly (may be empty). Derived folders are not listed. */
  readonly folders: ReadonlySet<string>;
  /** Paths whose in-memory content differs from the last persisted content. */
  readonly dirty: ReadonlySet<string>;
  /** Monotonic counter; bumps on every mutation. Handy as a memo key. */
  readonly version: number;
}

export type FileChange =
  | { type: "hydrate" }
  | { type: "create"; path: string; content: string }
  | { type: "update"; path: string; content: string }
  | { type: "delete"; path: string; isFolder: boolean }
  | { type: "rename"; from: string; to: string; isFolder: boolean }
  | { type: "mkdir"; path: string }
  | { type: "saved"; path: string };

export class FileStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileStoreError";
  }
}

type Listener = () => void;
type ChangeListener = (change: FileChange) => void;

export class FileStore {
  private files = new Map<string, string>();
  private folders = new Set<string>();
  /** Last content confirmed written by the persistence layer. */
  private saved = new Map<string, string>();
  private version = 0;
  private snapshot: FileStoreSnapshot | null = null;

  private listeners = new Set<Listener>();
  private changeListeners = new Set<ChangeListener>();

  // ---------------------------------------------------------------- reads

  /** Stable between mutations, so it is safe for useSyncExternalStore. */
  getSnapshot(): FileStoreSnapshot {
    if (!this.snapshot) {
      const dirty = new Set<string>();
      for (const [path, content] of this.files) {
        if (this.saved.get(path) !== content) dirty.add(path);
      }
      this.snapshot = {
        files: new Map(this.files),
        folders: new Set(this.folders),
        dirty,
        version: this.version,
      };
    }
    return this.snapshot;
  }

  has(path: string): boolean {
    return this.files.has(path);
  }

  read(path: string): string | undefined {
    return this.files.get(path);
  }

  /** Plain object copy, suitable for postMessage to the bundler worker. */
  toRecord(): Record<string, string> {
    return Object.fromEntries(this.files);
  }

  isFolder(path: string): boolean {
    if (this.folders.has(path)) return true;
    for (const p of this.files.keys()) {
      if (p !== path && isInside(path, p)) return true;
    }
    return false;
  }

  // ------------------------------------------------------------- mutations

  /** Replace everything with persisted content; nothing is dirty afterwards. */
  hydrate(files: Record<string, string>, folders: string[] = []): void {
    this.files = new Map(Object.entries(files));
    this.saved = new Map(this.files);
    this.folders = new Set(folders.map(normalizePath));
    this.commit({ type: "hydrate" });
  }

  createFile(path: string, content = ""): void {
    this.assertValid(path);
    if (this.files.has(path)) throw new FileStoreError(`File already exists: ${path}`);
    if (this.isFolder(path)) throw new FileStoreError(`A folder exists at: ${path}`);
    this.files.set(path, content);
    this.ensureParentFolders(path);
    this.commit({ type: "create", path, content });
  }

  updateFile(path: string, content: string): void {
    const current = this.files.get(path);
    if (current === undefined) throw new FileStoreError(`No such file: ${path}`);
    if (current === content) return;
    this.files.set(path, content);
    this.commit({ type: "update", path, content });
  }

  createFolder(path: string): void {
    this.assertValid(path);
    if (this.files.has(path)) throw new FileStoreError(`A file exists at: ${path}`);
    if (this.isFolder(path)) throw new FileStoreError(`Folder already exists: ${path}`);
    this.folders.add(path);
    this.ensureParentFolders(path);
    this.commit({ type: "mkdir", path });
  }

  /** Delete a file, or a folder and everything beneath it. */
  delete(path: string): void {
    if (this.files.has(path)) {
      this.files.delete(path);
      this.saved.delete(path);
      this.commit({ type: "delete", path, isFolder: false });
      return;
    }
    if (!this.isFolder(path)) throw new FileStoreError(`No such file or folder: ${path}`);
    for (const p of [...this.files.keys()]) {
      if (isInside(path, p)) {
        this.files.delete(p);
        this.saved.delete(p);
      }
    }
    for (const f of [...this.folders]) {
      if (isInside(path, f)) this.folders.delete(f);
    }
    this.commit({ type: "delete", path, isFolder: true });
  }

  /** Rename/move a file or folder. Folder renames re-key every descendant. */
  rename(from: string, to: string): void {
    if (from === to) return;
    this.assertValid(to);
    if (this.files.has(to) || this.isFolder(to)) {
      throw new FileStoreError(`Target already exists: ${to}`);
    }

    if (this.files.has(from)) {
      this.moveKey(from, to);
      this.ensureParentFolders(to);
      this.commit({ type: "rename", from, to, isFolder: false });
      return;
    }

    if (!this.isFolder(from)) throw new FileStoreError(`No such file or folder: ${from}`);
    if (isInside(from, to)) throw new FileStoreError(`Cannot move a folder into itself`);

    for (const p of [...this.files.keys()]) {
      if (isInside(from, p)) this.moveKey(p, to + p.slice(from.length));
    }
    for (const f of [...this.folders]) {
      if (isInside(from, f)) {
        this.folders.delete(f);
        this.folders.add(to + f.slice(from.length));
      }
    }
    this.ensureParentFolders(to);
    this.commit({ type: "rename", from, to, isFolder: true });
  }

  /**
   * Called by the persistence layer after a write lands. Only clears the dirty
   * flag if the content that was written is still the current content.
   */
  markSaved(path: string, content: string): void {
    if (!this.files.has(path)) return;
    this.saved.set(path, content);
    this.commit({ type: "saved", path });
  }

  // ------------------------------------------------------------ subscribe

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onChange(listener: ChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  // -------------------------------------------------------------- private

  private commit(change: FileChange): void {
    this.version++;
    this.snapshot = null;
    for (const l of this.changeListeners) l(change);
    for (const l of this.listeners) l();
  }

  private moveKey(from: string, to: string): void {
    this.files.set(to, this.files.get(from)!);
    this.files.delete(from);
    // The new path has never been written, so it starts dirty until the
    // persistence layer confirms the rename via markSaved.
    this.saved.delete(from);
  }

  private ensureParentFolders(path: string): void {
    // Explicit folder entries above a file are redundant; drop them so the
    // explicit set only ever holds genuinely empty folders.
    let dir = dirname(path);
    while (dir !== "/") {
      this.folders.delete(dir);
      dir = dirname(dir);
    }
  }

  private assertValid(path: string): void {
    const err = validatePath(path);
    if (err) throw new FileStoreError(err);
  }
}

/** App-wide singleton. Workers and hooks import this instance. */
export const fileStore = new FileStore();
