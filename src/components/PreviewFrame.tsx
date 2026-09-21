import { useMemo } from "react";
import type { BundleMessage } from "../bundler/types";
import { buildIframeDoc } from "../services/iframeTeemplate";

interface PreviewFrameProps {
  bundle: string;
  errors?: BundleMessage[];
  onProblemClick?: (m: BundleMessage) => void;
}

/**
 * Renders the bundled app in a sandboxed iframe. Build errors are shown in an
 * overlay while the last good bundle keeps running underneath, so a typo does
 * not blank the preview.
 */
export default function PreviewFrame({ bundle, errors = [], onProblemClick }: PreviewFrameProps) {
  const srcDoc = useMemo(() => buildIframeDoc(bundle), [bundle]);

  return (
    <div className="ws-preview-wrap">
      {bundle ? (
        <iframe
          key={bundle} // force full remount on every new bundle
          srcDoc={srcDoc}
          sandbox="allow-scripts" // NO allow-same-origin — keeps it isolated
          style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
          title="preview"
        />
      ) : (
        <div className="ws-empty">Waiting for the first build…</div>
      )}

      {errors.length > 0 && (
        <div className="ws-problems" role="alert">
          {errors.map((m, i) => (
            <div
              key={i}
              className="ws-problem"
              onClick={() => m.file && onProblemClick?.(m)}
              title={m.file ? "Click to jump to the error" : undefined}
            >
              {m.file && (
                <span className="loc">
                  {m.file}
                  {m.line ? `:${m.line}` : ""}
                  {m.column ? `:${m.column}` : ""}{" "}
                </span>
              )}
              <span className="msg">{m.text}</span>
              {m.lineText && <span className="src">{m.lineText.trim()}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
