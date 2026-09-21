/**
 * Keeps one Monaco text model per project file, mirroring the FileStore.
 *
 * Why not let @monaco-editor/react create models lazily? Because Monaco's
 * TypeScript service only knows about files that have a model. Creating
 * models for every file up front gives cross-file IntelliSense, go-to-
 * definition and import diagnostics across the whole project, not just the
 * tabs the user has opened.
 *
 * URIs use monaco.Uri.parse(path) so they match what the React wrapper's
 * `path` prop produces; the wrapper then reuses these models instead of
 * creating duplicates.
 */
import * as monaco from "monaco-editor";
import { fileStore, type FileChange } from "../fs/fileStore";
import { extname, isInside } from "../fs/pathUtils";

const LANGUAGES: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".json": "json",
  ".css": "css",
  ".html": "html",
  ".md": "markdown",
};

export function languageFor(path: string): string {
  return LANGUAGES[extname(path)] ?? "plaintext";
}

export function uriFor(path: string): monaco.Uri {
  return monaco.Uri.parse(path);
}

const models = new Map<string, monaco.editor.ITextModel>();
let unsubscribe: (() => void) | null = null;

function create(path: string, content: string): monaco.editor.ITextModel {
  const uri = uriFor(path);
  const model = monaco.editor.getModel(uri) ?? monaco.editor.createModel(content, languageFor(path), uri);
  models.set(path, model);
  return model;
}

function dispose(path: string): void {
  models.get(path)?.dispose();
  models.delete(path);
}

/** Replace content in place, preserving the undo stack (unlike setValue). */
function setContent(model: monaco.editor.ITextModel, content: string): void {
  if (model.getValue() === content) return;
  model.pushEditOperations(
    [],
    [{ range: model.getFullModelRange(), text: content }],
    () => null,
  );
}

function apply(change: FileChange): void {
  switch (change.type) {
    case "hydrate": {
      for (const p of [...models.keys()]) dispose(p);
      for (const [p, c] of fileStore.getSnapshot().files) create(p, c);
      return;
    }
    case "create":
      create(change.path, change.content);
      return;
    case "update": {
      const m = models.get(change.path);
      if (m) setContent(m, change.content);
      else create(change.path, change.content);
      return;
    }
    case "delete":
      for (const p of [...models.keys()]) {
        if (isInside(change.path, p)) dispose(p);
      }
      return;
    case "rename":
      for (const p of [...models.keys()]) {
        if (!isInside(change.from, p)) continue;
        const next = change.to + p.slice(change.from.length);
        const content = models.get(p)!.getValue();
        dispose(p);
        create(next, content);
      }
      return;
    case "mkdir":
    case "saved":
      return;
  }
}

/** Start mirroring. Safe to call more than once. */
export function startMonacoModelSync(): () => void {
  if (!unsubscribe) {
    apply({ type: "hydrate" });
    unsubscribe = fileStore.onChange(apply);
  }
  return () => {
    unsubscribe?.();
    unsubscribe = null;
  };
}
