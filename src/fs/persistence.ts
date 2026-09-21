/**
 * Write-through persistence from the in-memory FileStore to OPFS.
 *
 * - Content edits are debounced per file (typing does not hammer the disk).
 * - Structural changes (create, mkdir, delete, rename) are sent immediately,
 *   and any pending debounced write for affected paths is cancelled first so
 *   a stale write cannot resurrect a deleted or renamed file.
 * - Operations are queued through a single promise chain so they reach the
 *   worker in the exact order the store emitted them.
 * - `flushAll()` forces every pending write out now (used by Cmd+S).
 */
import { fileStore, type FileChange, type FileStore } from "./fileStore";
import { OpfsAdapter } from "./opfsAdapter";
import { isInside } from "./pathUtils";

export interface PersistenceOptions {
  debounceMs?: number;
}

type Listener = () => void;

export class Persistence {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private queue: Promise<void> = Promise.resolve();
  private pendingOps = 0;
  private lastError: string | null = null;
  private unsubscribe: (() => void) | null = null;
  private listeners = new Set<Listener>();
  private readonly debounceMs: number;
  private readonly store: FileStore;
  readonly adapter: OpfsAdapter;

  constructor(store: FileStore, adapter: OpfsAdapter, options: PersistenceOptions = {}) {
    this.store = store;
    this.adapter = adapter;
    this.debounceMs = options.debounceMs ?? 400;
  }

  /** Start mirroring store changes to disk. Idempotent. */
  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.store.onChange((c) => this.handleChange(c));
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  /** True while any write is pending or in flight. */
  get isSaving(): boolean {
    return this.timers.size > 0 || this.pendingOps > 0;
  }

  get error(): string | null {
    return this.lastError;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Write every debounced edit now and wait for the queue to drain. */
  async flushAll(): Promise<void> {
    for (const path of [...this.timers.keys()]) this.flushPath(path);
    await this.queue;
  }

  // ---------------------------------------------------------------- private

  private handleChange(change: FileChange): void {
    switch (change.type) {
      case "hydrate":
      case "saved":
        return;
      case "update":
        this.scheduleWrite(change.path);
        return;
      case "create":
        this.enqueue(() => this.adapter.write(change.path, change.content), () =>
          this.store.markSaved(change.path, change.content),
        );
        return;
      case "mkdir":
        this.enqueue(() => this.adapter.mkdir(change.path));
        return;
      case "delete":
        this.cancelUnder(change.path);
        this.enqueue(() => this.adapter.delete(change.path));
        return;
      case "rename": {
        // Anything still pending under the old path is written first (in the
        // queue, before the rename), so the rename moves current content.
        for (const path of [...this.timers.keys()]) {
          if (isInside(change.from, path)) this.flushPath(path);
        }
        this.enqueue(
          () => this.adapter.rename(change.from, change.to),
          () => {
            const snap = this.store.getSnapshot();
            for (const [path, content] of snap.files) {
              if (isInside(change.to, path)) this.store.markSaved(path, content);
            }
          },
        );
        return;
      }
    }
  }

  private scheduleWrite(path: string): void {
    const existing = this.timers.get(path);
    if (existing) clearTimeout(existing);
    this.timers.set(
      path,
      setTimeout(() => this.flushPath(path), this.debounceMs),
    );
    this.notify();
  }

  private flushPath(path: string): void {
    const t = this.timers.get(path);
    if (t) clearTimeout(t);
    this.timers.delete(path);
    const content = this.store.read(path);
    if (content === undefined) return; // deleted or renamed away meanwhile
    this.enqueue(
      () => this.adapter.write(path, content),
      () => this.store.markSaved(path, content),
    );
  }

  private cancelUnder(path: string): void {
    for (const [p, t] of this.timers) {
      if (isInside(path, p)) {
        clearTimeout(t);
        this.timers.delete(p);
      }
    }
  }

  private enqueue(op: () => Promise<void>, onDone?: () => void): void {
    this.pendingOps++;
    this.notify();
    this.queue = this.queue
      .then(op)
      .then(() => {
        this.lastError = null;
        onDone?.();
      })
      .catch((err: unknown) => {
        this.lastError = err instanceof Error ? err.message : String(err);
        console.error("[persistence]", err);
      })
      .finally(() => {
        this.pendingOps--;
        this.notify();
      });
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }
}

export const persistence = new Persistence(fileStore, new OpfsAdapter());
