import type { BundleMessage, BundleRequest, BundleResponse } from "../bundler/types";

export interface BundleResult {
  code: string;
  warnings: BundleMessage[];
}

/** Thrown when the build fails; carries structured, per-file messages. */
export class BundleFailure extends Error {
  readonly errors: BundleMessage[];
  constructor(errors: BundleMessage[]) {
    super(errors.map((e) => e.text).join("\n"));
    this.name = "BundleFailure";
    this.errors = errors;
  }
}

type Pending = {
  resolve: (r: BundleResult) => void;
  reject: (e: unknown) => void;
};

/**
 * Main-thread facade over the bundler worker. One lazily-created worker,
 * request/response matched by id. Callers are expected to ignore results that
 * are older than their latest request (see useBundler).
 */
class BundlerService {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;

  private getWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(new URL("../workers/bundler.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (e: MessageEvent<BundleResponse>) => {
      const msg = e.data;
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (msg.ok) pending.resolve({ code: msg.code, warnings: msg.warnings });
      else pending.reject(new BundleFailure(msg.errors));
    };

    worker.onerror = (e) => {
      // A crashed worker cannot answer anything in flight; fail them all and
      // let the next call spin up a fresh worker.
      const err = new Error(`Bundler worker crashed: ${e.message}`);
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
      worker.terminate();
      this.worker = null;
    };

    this.worker = worker;
    return worker;
  }

  bundle(entry: string, files: Record<string, string>): Promise<BundleResult> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      const request: BundleRequest = { id, entry, files };
      this.getWorker().postMessage(request);
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}

export const bundlerService = new BundlerService();
