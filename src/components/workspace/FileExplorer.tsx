import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { buildTree, type TreeNode } from "../../fs/buildTree";
import { fileStore, FileStoreError } from "../../fs/fileStore";
import { dirname } from "../../fs/pathUtils";
import { useFileStore } from "../../hooks/useFileStore";

interface FileExplorerProps {
  activePath: string | null;
  onOpen: (path: string) => void;
  readOnly: boolean;
}

type Editing =
  | { mode: "create-file" | "create-folder"; parent: string }
  | { mode: "rename"; path: string; kind: "file" | "folder" };

export default function FileExplorer({ activePath, onOpen, readOnly }: FileExplorerProps) {
  const { files, folders, dirty } = useFileStore();
  const tree = buildTree(files, folders);

  const [expanded, setExpanded] = useState<Set<string>>(() => ancestorsOf(activePath, new Set(["/src"])));
  const [editing, setEditing] = useState<Editing | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep the active file's ancestors expanded so it is always visible. This
  // is derived state, so it is adjusted during render (React's recommended
  // alternative to a setState-in-effect) when the active path changes.
  const [prevActive, setPrevActive] = useState(activePath);
  if (activePath !== prevActive) {
    setPrevActive(activePath);
    if (activePath) setExpanded(ancestorsOf(activePath, expanded));
  }

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const startCreate = (mode: "create-file" | "create-folder", parent: string) => {
    setError(null);
    setExpanded((prev) => new Set(prev).add(parent));
    setEditing({ mode, parent });
  };

  const startRename = (node: TreeNode) => {
    setError(null);
    setEditing({ mode: "rename", path: node.path, kind: node.kind });
  };

  const commit = (name: string) => {
    if (!editing) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setEditing(null);
      return;
    }
    try {
      if (editing.mode === "rename") {
        const to = `${dirname(editing.path)}/${trimmed}`.replace("//", "/");
        fileStore.rename(editing.path, to);
        if (editing.kind === "file" && activePath === editing.path) onOpen(to);
      } else {
        const path = editing.parent === "/" ? `/${trimmed}` : `${editing.parent}/${trimmed}`;
        if (editing.mode === "create-file") {
          fileStore.createFile(path, "");
          onOpen(path);
        } else {
          fileStore.createFolder(path);
          setExpanded((prev) => new Set(prev).add(path));
        }
      }
      setEditing(null);
      setError(null);
    } catch (err) {
      setError(err instanceof FileStoreError ? err.message : String(err));
    }
  };

  const remove = (node: TreeNode) => {
    const what = node.kind === "folder" ? `folder "${node.path}" and everything in it` : `"${node.path}"`;
    if (!window.confirm(`Delete ${what}?`)) return;
    try {
      fileStore.delete(node.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const renderNodes = (nodes: TreeNode[], depth: number) =>
    nodes.map((node) => {
      const isFolder = node.kind === "folder";
      const isOpen = isFolder && expanded.has(node.path);
      const isRenaming = editing?.mode === "rename" && editing.path === node.path;
      const indent = 8 + depth * 12;

      return (
        <div key={node.path}>
          <div
            className={`ws-node${node.path === activePath ? " active" : ""}`}
            style={{ paddingLeft: indent }}
            title={node.path}
            onClick={() => (isFolder ? toggle(node.path) : onOpen(node.path))}
          >
            <span className="chevron">{isFolder ? (isOpen ? "▾" : "▸") : ""}</span>
            {isRenaming ? (
              <InlineInput initial={node.name} onCommit={commit} onCancel={() => setEditing(null)} />
            ) : (
              <span className={`name${dirty.has(node.path) ? " dirty" : ""}`}>{node.name}</span>
            )}
            {!readOnly && !isRenaming && (
              <span className="actions" onClick={(e) => e.stopPropagation()}>
                {isFolder && (
                  <>
                    <button className="ws-icon-btn" title="New file" onClick={() => startCreate("create-file", node.path)}>＋</button>
                    <button className="ws-icon-btn" title="New folder" onClick={() => startCreate("create-folder", node.path)}>▣</button>
                  </>
                )}
                <button className="ws-icon-btn" title="Rename" onClick={() => startRename(node)}>✎</button>
                <button className="ws-icon-btn danger" title="Delete" onClick={() => remove(node)}>🗑</button>
              </span>
            )}
          </div>

          {isFolder && isOpen && (
            <>
              {editing && editing.mode !== "rename" && editing.parent === node.path && (
                <NewEntryRow depth={depth + 1} editing={editing} onCommit={commit} onCancel={() => setEditing(null)} />
              )}
              {renderNodes(node.children ?? [], depth + 1)}
            </>
          )}
        </div>
      );
    });

  return (
    <aside className="ws-explorer">
      <div className="ws-explorer-header">
        <span>Explorer</span>
        {!readOnly && (
          <span className="actions">
            <button className="ws-icon-btn" title="New file at root" onClick={() => startCreate("create-file", "/")}>＋</button>
            <button className="ws-icon-btn" title="New folder at root" onClick={() => startCreate("create-folder", "/")}>▣</button>
          </span>
        )}
      </div>
      {editing && editing.mode !== "rename" && editing.parent === "/" && (
        <NewEntryRow depth={0} editing={editing} onCommit={commit} onCancel={() => setEditing(null)} />
      )}
      {renderNodes(tree, 0)}
      {error && <div className="ws-inline-error">{error}</div>}
    </aside>
  );
}

/** Return a copy of `base` with every ancestor folder of `path` added. */
function ancestorsOf(path: string | null, base: ReadonlySet<string>): Set<string> {
  const next = new Set(base);
  if (!path) return next;
  let dir = dirname(path);
  while (dir !== "/") {
    next.add(dir);
    dir = dirname(dir);
  }
  return next;
}

function NewEntryRow({
  depth,
  editing,
  onCommit,
  onCancel,
}: {
  depth: number;
  editing: Extract<Editing, { mode: "create-file" | "create-folder" }>;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="ws-node" style={{ paddingLeft: 8 + depth * 12 }}>
      <span className="chevron">{editing.mode === "create-folder" ? "▸" : ""}</span>
      <InlineInput
        initial=""
        placeholder={editing.mode === "create-file" ? "filename.tsx" : "folder-name"}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    </div>
  );
}

function InlineInput({
  initial,
  placeholder,
  onCommit,
  onCancel,
}: {
  initial: string;
  placeholder?: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Select the stem only, so renaming "App.tsx" keeps the extension.
    const dot = initial.lastIndexOf(".");
    el.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onCommit(value);
    else if (e.key === "Escape") onCancel();
  };

  return (
    <input
      ref={ref}
      className="ws-inline-input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => (value.trim() && value !== initial ? onCommit(value) : onCancel())}
      onClick={(e) => e.stopPropagation()}
      spellCheck={false}
    />
  );
}
