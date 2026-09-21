import { useEffect, useRef, useState } from "react";
import type { BundleMessage } from "../bundler/types";
import { initWorkspace, type WorkspaceInfo } from "../fs/bootstrap";
import { persistence } from "../fs/persistence";
import { ENTRY_FILE } from "../fs/template";
import { useBundler } from "../hooks/useBundler";
import { useFileStore } from "../hooks/useFileStore";
import { usePersistenceStatus } from "../hooks/usePersistenceStatus";
import { usePreviewSync } from "../hooks/usePreviewSync";
import { useStoredState } from "../hooks/useStoredState";
import { useWorkspaceTabs } from "../hooks/useWorkspaceTabs";
import { startMonacoModelSync } from "../services/monacoModels";
import PreviewFrame from "./PreviewFrame";
import ResizeHandle from "./workspace/ResizeHandle";
import EditorPane from "./workspace/EditorPane";
import FileExplorer from "./workspace/FileExplorer";
import StatusBar from "./workspace/StatusBar";
import TabBar from "./workspace/TabBar";
import "../styles/workspace.css";

const EXPLORER = { default: 240, min: 160, max: 520 };
const PREVIEW = { default: 0.5, min: 0.15, max: 0.85 };
const RESIZER_WIDTH = 6;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export default function EditorPage() {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [explorerWidth, setExplorerWidth] = useStoredState("web-code:explorer-width", EXPLORER.default, isNumber);
  // Preview size is a fraction of the space left after the explorer, so it
  // stays proportional when the window is resized.
  const [previewRatio, setPreviewRatio] = useStoredState("web-code:preview-ratio", PREVIEW.default, isNumber);

  const resizeExplorer = (dx: number) =>
    setExplorerWidth((w) => clamp(w + dx, EXPLORER.min, EXPLORER.max));

  const resizePreview = (dx: number) => {
    const total = bodyRef.current?.clientWidth ?? 0;
    const available = total - explorerWidth - RESIZER_WIDTH * 2;
    if (available <= 0) return;
    // Dragging right shrinks the preview.
    setPreviewRatio((r) => clamp(r - dx / available, PREVIEW.min, PREVIEW.max));
  };

  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ path: string; line: number; column: number; nonce: number } | null>(null);

  const { files, dirty } = useFileStore();
  const { tabs, active, open, close } = useWorkspaceTabs();
  const { code, errors, warnings, isBundling } = useBundler(files, ENTRY_FILE);
  const { isSaving, error: saveError } = usePersistenceStatus();
  const { openPreview } = usePreviewSync(code);

  // Boot once: hydrate from OPFS (or seed), then mirror files into Monaco models.
  useEffect(() => {
    const stopModels = startMonacoModelSync();
    initWorkspace().then(setWorkspace, (err: unknown) =>
      setBootError(err instanceof Error ? err.message : String(err)),
    );
    return stopModels;
  }, []);

  // First load with nothing open: show the entry file.
  useEffect(() => {
    if (workspace && !active && files.has(ENTRY_FILE)) open(ENTRY_FILE);
  }, [workspace, active, files, open]);

  const readOnly = workspace?.mode === "read-only";
  // Tabs are restored from localStorage before OPFS hydrates; do not mount an
  // empty editor for a file the store has not loaded yet.
  const activeLoaded = active !== null && files.has(active) ? active : null;
  const activeContent = activeLoaded ? files.get(activeLoaded)! : "";

  const jumpToProblem = (m: BundleMessage) => {
    if (!m.file) return;
    open(m.file);
    setReveal({ path: m.file, line: m.line ?? 1, column: m.column ?? 1, nonce: Date.now() });
  };

  return (
    <div className="ws-root">
      <header className="ws-toolbar">
        <span className="title">Web Code</span>
        <span className="spacer" />
        {!readOnly && workspace?.mode === "opfs" && (
          <button className="ws-btn" onClick={() => void persistence.flushAll()} title="Cmd/Ctrl+S">
            Save all
          </button>
        )}
        <button className="ws-btn primary" onClick={openPreview}>
          Open preview in new window ↗
        </button>
      </header>

      {workspace?.note && <div className="ws-banner">{workspace.note}</div>}
      {bootError && <div className="ws-banner">Failed to load workspace: {bootError}</div>}

      <div className="ws-body" ref={bodyRef}>
        <div style={{ width: explorerWidth, display: "flex", flexShrink: 0 }}>
          <FileExplorer activePath={active} onOpen={open} readOnly={readOnly} />
        </div>
        <ResizeHandle
          label="Resize explorer"
          onResize={resizeExplorer}
          onReset={() => setExplorerWidth(EXPLORER.default)}
        />

        <main className="ws-main">
          <TabBar tabs={tabs} activePath={active} dirty={dirty} onSelect={open} onClose={close} />
          <div className="ws-editor">
            <EditorPane
              path={activeLoaded}
              content={activeContent}
              readOnly={readOnly}
              onSave={() => void persistence.flushAll()}
              reveal={reveal}
            />
          </div>
        </main>

        <ResizeHandle
          label="Resize preview"
          onResize={resizePreview}
          onReset={() => setPreviewRatio(PREVIEW.default)}
        />
        <section
          className="ws-preview"
          style={{
            flexBasis: `calc((100% - ${explorerWidth + RESIZER_WIDTH * 2}px) * ${previewRatio})`,
          }}
        >
          <PreviewFrame bundle={code} errors={errors} onProblemClick={jumpToProblem} />
        </section>
      </div>

      <StatusBar
        isBundling={isBundling}
        errorCount={errors.length}
        warningCount={warnings.length}
        isSaving={isSaving}
        dirtyCount={dirty.size}
        saveError={saveError}
        mode={workspace?.mode ?? "loading"}
        fileCount={files.size}
      />
    </div>
  );
}
