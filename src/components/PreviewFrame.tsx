import { useMemo } from 'react'
import { buildIframeDoc } from '../services/iframeTeemplate'

interface PreviewFrameProps {
  bundle: string
  error?: string | null
}

export default function PreviewFrame({ bundle, error }: PreviewFrameProps) {
  const srcDoc = useMemo(() => {
    if (!bundle) return buildIframeDoc('')
    return buildIframeDoc(bundle)
  }, [bundle])

  if (error) {
    return (
      <div style={{
        padding: 16,
        fontFamily: 'monospace',
        color: '#f87171',
        background: '#1c1c1c',
        height: '100%',
        whiteSpace: 'pre-wrap',
      }}>
        <strong>Transpile Error</strong>{'\n'}{error}
      </div>
    )
  }

  if (!bundle) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#555',
        fontFamily: 'monospace',
      }}>
        Waiting for output...
      </div>
    )
  }

  return (
    <iframe
      key={bundle}              // force full remount on every new bundle
      srcDoc={srcDoc}
      sandbox="allow-scripts"  // NO allow-same-origin — keeps it isolated
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        background: '#fff',
      }}
      title="preview"
    />
  )
}