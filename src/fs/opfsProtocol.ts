/** Message protocol between the main thread and the OPFS worker. */

export type FsRequest =
  | { id: number; op: "readAll" }
  | { id: number; op: "write"; path: string; content: string }
  | { id: number; op: "mkdir"; path: string }
  | { id: number; op: "delete"; path: string }
  | { id: number; op: "rename"; from: string; to: string }
  | { id: number; op: "clear" };

export interface ReadAllResult {
  files: Record<string, string>;
  /** Every directory found, including non-empty ones. */
  dirs: string[];
}

export type FsResponse =
  | { id: number; ok: true; result?: ReadAllResult }
  | { id: number; ok: false; error: string };
