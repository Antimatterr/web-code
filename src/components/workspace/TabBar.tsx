import { basename, dirname } from "../../fs/pathUtils";

interface TabBarProps {
  tabs: string[];
  activePath: string | null;
  dirty: ReadonlySet<string>;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export default function TabBar({ tabs, activePath, dirty, onSelect, onClose }: TabBarProps) {
  // When two open files share a name, show the parent folder to tell them apart.
  const nameCounts = new Map<string, number>();
  for (const t of tabs) {
    const n = basename(t);
    nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
  }

  return (
    <div className="ws-tabs" role="tablist">
      {tabs.map((path) => {
        const name = basename(path);
        const ambiguous = (nameCounts.get(name) ?? 0) > 1;
        const isActive = path === activePath;
        const isDirty = dirty.has(path);
        return (
          <div
            key={path}
            role="tab"
            aria-selected={isActive}
            className={`ws-tab${isActive ? " active" : ""}${isDirty ? " dirty" : ""}`}
            title={path}
            onClick={() => onSelect(path)}
            onAuxClick={(e) => {
              if (e.button === 1) onClose(path);
            }}
          >
            <span>{name}</span>
            {ambiguous && <span className="hint">{dirname(path)}</span>}
            <button
              className="close"
              aria-label={`Close ${name}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(path);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
