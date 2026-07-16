import { useState } from 'react'
import MonacoEditor from '@monaco-editor/react'
import type { Monaco } from '@monaco-editor/react'
import '../services/monacoSetup' // self-host Monaco (loader + workers), no CDN
import { useTranspiler } from '../hooks/useTrasnpiler'
import { usePreviewSync } from '../hooks/usePreviewSync'
import PreviewFrame from '../components/PreviewFrame'

const SAMPLE = `
import {useState} from 'react'
export default function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: 32 }}>
      <h1>Hello from JSX! 👋</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>
        Click me
      </button>
    </div>
  )
}`

// Teach Monaco's TS language service about JSX so it stops flagging valid
// component code. The actual transpile is done by esbuild, not Monaco — this
// only affects in-editor highlighting and diagnostics.
function configureMonaco(monaco: Monaco) {
  const ts = monaco.languages.typescript
  ts.typescriptDefaults.setCompilerOptions({
    jsx: ts.JsxEmit.ReactJSX,
    jsxImportSource: 'react',
    target: ts.ScriptTarget.ES2020,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    allowNonTsExtensions: true,
    esModuleInterop: true,
    noImplicitAny: false,
  })
  // React types aren't loaded in the browser, so silence the module-resolution
  // and JSX-runtime diagnostics for a clean playground experience.
  ts.typescriptDefaults.setDiagnosticsOptions({
    diagnosticCodesToIgnore: [2307, 2792, 2875, 6133, 7016, 7044],
  })
}

export default function EditorPage() {
  const [code, setCode] = useState(SAMPLE)
  const { output, error, isCompiling } = useTranspiler(code)
  const { openPreview } = usePreviewSync(output)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 16px', background: '#252526', borderBottom: '1px solid #333'
      }}>
        <span style={{ color: '#d4d4d4', fontWeight: 600 }}>JSX Editor</span>
        <span style={{ marginLeft: 'auto', color: '#888', fontSize: 12 }}>
          {isCompiling ? '⏳ Compiling...' : '✅ Ready'}
        </span>
        <button
          onClick={openPreview}
          style={{
            padding: '4px 12px', background: '#0e7490',
            color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer'
          }}
        >
          Open in new window ↗
        </button>
      </div>

      {/* Editor + Preview split */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Editor pane */}
        <div style={{ flex: 1, borderRight: '1px solid #333', overflow: 'hidden' }}>
          <MonacoEditor
            height="100%"
            theme="vs-dark"
            language="typescript"
            path="main.tsx"
            beforeMount={configureMonaco}
            value={code}
            onChange={value => setCode(value ?? '')}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
            }}
          />
        </div>

        {/* Inline preview pane (default view) */}
        <div style={{ flex: 1 }}>
          <PreviewFrame bundle={output} error={error} />
        </div>

      </div>
    </div>
  )
}