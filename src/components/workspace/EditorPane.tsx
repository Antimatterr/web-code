import MonacoEditor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import "../../services/monacoSetup";
import { fileStore } from "../../fs/fileStore";
import { languageFor } from "../../services/monacoModels";

interface EditorPaneProps {
  path: string | null;
  content: string;
  readOnly: boolean;
  onSave: () => void;
  /** Reveal a position, e.g. when clicking a build error. */
  reveal?: { path: string; line: number; column: number; nonce: number } | null;
}

function configureMonaco(monaco: Monaco) {
  const ts = monaco.languages.typescript;
  ts.typescriptDefaults.setCompilerOptions({
    jsx: ts.JsxEmit.ReactJSX,
    jsxImportSource: "react",
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    allowNonTsExtensions: true,
    allowJs: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    noImplicitAny: false,
  });
  ts.typescriptDefaults.setEagerModelSync(true);
  // Package types are not loaded yet (that is the type-acquisition phase), so
  // silence "cannot find module 'react'"-style diagnostics for bare imports.
  ts.typescriptDefaults.setDiagnosticsOptions({
    diagnosticCodesToIgnore: [2307, 2792, 2875, 6133, 7016, 7026, 7044],
  });
}

export default function EditorPane({ path, content, readOnly, onSave, reveal }: EditorPaneProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSaveRef.current());
  };

  // Jump to a requested position once the matching file is the active model.
  useEffect(() => {
    const editor = editorRef.current;
    if (!reveal || !editor || reveal.path !== path) return;
    editor.revealLineInCenter(reveal.line);
    editor.setPosition({ lineNumber: reveal.line, column: reveal.column });
    editor.focus();
  }, [reveal, path]);

  if (!path) {
    return <div className="ws-empty">Open a file from the explorer to start editing.</div>;
  }

  return (
    <MonacoEditor
      height="100%"
      theme="vs-dark"
      path={path}
      language={languageFor(path)}
      value={content}
      beforeMount={configureMonaco}
      onMount={onMount}
      onChange={(value) => {
        if (!readOnly && value !== undefined) fileStore.updateFile(path, value);
      }}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        readOnly,
      }}
    />
  );
}
