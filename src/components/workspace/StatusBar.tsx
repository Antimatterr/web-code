import type { StorageMode } from "../../fs/bootstrap";

interface StatusBarProps {
  isBundling: boolean;
  errorCount: number;
  warningCount: number;
  isSaving: boolean;
  dirtyCount: number;
  saveError: string | null;
  mode: StorageMode | "loading";
  fileCount: number;
}

const MODE_LABEL: Record<StatusBarProps["mode"], string> = {
  loading: "Loading…",
  opfs: "Saved to browser storage",
  "read-only": "Read-only (another tab is editing)",
  memory: "In-memory only",
};

export default function StatusBar(p: StatusBarProps) {
  const build = p.mode === "loading"
    ? "Loading workspace…"
    : p.isBundling
    ? "Bundling…"
    : p.errorCount > 0
      ? `${p.errorCount} error${p.errorCount === 1 ? "" : "s"}`
      : "Build OK";
  const buildClass = p.mode === "loading" || p.isBundling ? "" : p.errorCount > 0 ? "err" : "ok";

  const save = p.saveError
    ? `Save failed: ${p.saveError}`
    : p.isSaving
      ? "Saving…"
      : p.dirtyCount > 0
        ? `${p.dirtyCount} unsaved`
        : "All changes saved";
  const saveClass = p.saveError ? "err" : p.isSaving || p.dirtyCount > 0 ? "warn" : "";

  return (
    <footer className="ws-status">
      <span className={buildClass}>{build}</span>
      {p.warningCount > 0 && <span className="warn">{p.warningCount} warning{p.warningCount === 1 ? "" : "s"}</span>}
      <span className="spacer" />
      <span>{p.fileCount} files</span>
      {p.mode !== "memory" && p.mode !== "loading" && <span className={saveClass}>{save}</span>}
      <span>{MODE_LABEL[p.mode]}</span>
    </footer>
  );
}
