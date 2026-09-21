import type { FsRequest, FsResponse, ReadAllResult } from "./opfsProtocol";

/** True when this browser can host the OPFS worker at all. */
export function isOpfsSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.storage &&
    typeof navigator.storage.getDirectory === "function"
  );
}

/** Omit that distributes over each union member (plain Omit collapses unions). */
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
type FsRequestBody = DistributiveOmit<FsRequest, "id">;

type Pending = { resolve: (r: ReadAllResult | undefined) => void; reject: (e: Error) => void };

/**
 * Promise-based client for the OPFS worker. Requests are matched to responses
 * by id; the worker processes them in order, so a write followed by a delete
 * of the same path lands in that order.
 */
export class OpfsAdapter {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;

  private getWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("../workers/fs.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<FsResponse>) => {
      const msg = e.data;
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new Error(msg.error));
    };
    worker.onerror = (e) => {
      const err = new Error(`OPFS worker crashed: ${e.message}`);
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
      worker.terminate();
      this.worker = null;
    };
    this.worker = worker;
    return worker;
  }

  private send(req: FsRequestBody): Promise<ReadAllResult | undefined> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.getWorker().postMessage({ ...req, id } as FsRequest);
    });
  }

  async readAll(): Promise<ReadAllResult> {
    return (await this.send({ op: "readAll" })) as ReadAllResult;
  }
  async write(path: string, content: string): Promise<void> {
    await this.send({ op: "write", path, content });
  }
  async mkdir(path: string): Promise<void> {
    await this.send({ op: "mkdir", path });
  }
  async delete(path: string): Promise<void> {
    await this.send({ op: "delete", path });
  }
  async rename(from: string, to: string): Promise<void> {
    await this.send({ op: "rename", from, to });
  }
  async clear(): Promise<void> {
    await this.send({ op: "clear" });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}
