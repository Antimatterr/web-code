// Self-host Monaco instead of loading it from the jsDelivr CDN.
//
// 1. Point @monaco-editor/react's loader at the locally-bundled `monaco-editor`
//    package so no network request is made for the editor core.
// 2. Wire up Monaco's language web workers using Vite's `?worker` imports so the
//    TypeScript/JSON/CSS/HTML services run from bundled assets, also offline.
//
// Importing this module for its side effects (before the editor mounts) is all
// that's required — see Editor.tsx.
import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    switch (label) {
      case 'json':
        return new jsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker()
      case 'typescript':
      case 'javascript':
        return new tsWorker()
      default:
        return new editorWorker()
    }
  },
}

loader.config({ monaco })
