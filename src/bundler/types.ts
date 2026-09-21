/** Message protocol between the main thread and the bundler worker. */

export interface BundleRequest {
  id: number;
  /** Absolute project path of the entry module, e.g. "/src/main.tsx". */
  entry: string;
  /** Snapshot of the whole project: path -> content. */
  files: Record<string, string>;
}

export interface BundleMessage {
  text: string;
  /** Absolute project path, when the message points at a file. */
  file?: string;
  line?: number;
  column?: number;
  /** Source line text, when esbuild provides it. */
  lineText?: string;
}

export type BundleResponse =
  | { id: number; ok: true; code: string; warnings: BundleMessage[] }
  | { id: number; ok: false; errors: BundleMessage[] };
