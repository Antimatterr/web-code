import { useRef, type PointerEvent } from "react";

interface ResizeHandleProps {
  /** Called with the horizontal movement in px since the last call. */
  onResize: (deltaX: number) => void;
  /** Double-click resets to the default size. */
  onReset?: () => void;
  label: string;
}

/**
 * Vertical drag bar between two panes.
 *
 * Uses pointer capture so the drag keeps tracking even when the cursor moves
 * over the preview iframe (iframes normally swallow pointer events). While
 * dragging, a body class also disables iframe hit-testing and text selection.
 */
export default function ResizeHandle({ onResize, onReset, label }: ResizeHandleProps) {
  const lastX = useRef<number | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    lastX.current = e.clientX;
    document.body.classList.add("ws-dragging");
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (lastX.current === null) return;
    const delta = e.clientX - lastX.current;
    if (delta !== 0) {
      lastX.current = e.clientX;
      onResize(delta);
    }
  };

  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (lastX.current === null) return;
    lastX.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.classList.remove("ws-dragging");
  };

  return (
    <div
      className="ws-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title="Drag to resize. Double-click to reset."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={onReset}
    />
  );
}
