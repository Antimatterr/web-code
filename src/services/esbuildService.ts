import type { TranspileRequest, TranspileResponse } from "../workers/worker";
type PendingRequest = {
  resolve: (code: string) => void;
  reject: (code: unknown) => void;
};

class EsbuildService {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingRequest>();
  private idCounter = 0;

  private getWorker(): Worker {
    if (!this.worker) {
      //create a worker if not exist
      this.worker = new Worker(
        new URL("../workers/worker.ts", import.meta.url),
        { type: "module" },
      );

      this.worker.onmessage = (e: MessageEvent<TranspileResponse>) => {
        const { id, code, error } = e.data;
        const pending = this.pending.get(id);
        if (!pending) return;

        this.pending.delete(id);

        if (error) {
          pending.reject(new Error(error));
        } else {
          pending.resolve(code!);
        }
      };

      this.worker.onerror = (e) => {
        console.error("[esbuild worker error]", e.message);
      };
    }

    return this.worker;
  }

  transpile(code: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const id = String(this.idCounter++);
      this.pending.set(id, { resolve, reject });

      const request: TranspileRequest = { id, code };
      this.getWorker().postMessage(request);
    });
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}

export const esbuildService = new EsbuildService();
