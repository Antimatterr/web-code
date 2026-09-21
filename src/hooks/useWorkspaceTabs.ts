import { useCallback, useEffect, useState } from "react";
import { fileStore } from "../fs/fileStore";
import { isInside } from "../fs/pathUtils";

const UI_KEY = "web-code:tabs";

interface TabState {
  tabs: string[];
  active: string | null;
}

function load(): TabState {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TabState;
      if (Array.isArray(parsed.tabs)) return parsed;
    }
  } catch {
    /* ignore corrupt state */
  }
  return { tabs: [], active: null };
}

/**
 * Open-tab list + active tab, persisted to localStorage, and kept consistent
 * with the file store: deleted files close their tabs, renamed files move.
 */
export function useWorkspaceTabs() {
  const [state, setState] = useState<TabState>(load);

  useEffect(() => {
    localStorage.setItem(UI_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    return fileStore.onChange((change) => {
      if (change.type === "delete") {
        setState((s) => {
          const tabs = s.tabs.filter((t) => !isInside(change.path, t));
          const active = s.active && isInside(change.path, s.active) ? tabs[tabs.length - 1] ?? null : s.active;
          return { tabs, active };
        });
      } else if (change.type === "rename") {
        const move = (p: string) => (isInside(change.from, p) ? change.to + p.slice(change.from.length) : p);
        setState((s) => ({ tabs: s.tabs.map(move), active: s.active ? move(s.active) : null }));
      } else if (change.type === "hydrate") {
        // Drop tabs pointing at files that no longer exist (e.g. after reload).
        setState((s) => {
          const tabs = s.tabs.filter((t) => fileStore.has(t));
          const active = s.active && fileStore.has(s.active) ? s.active : tabs[0] ?? null;
          return { tabs, active };
        });
      }
    });
  }, []);

  const open = useCallback((path: string) => {
    setState((s) => ({
      tabs: s.tabs.includes(path) ? s.tabs : [...s.tabs, path],
      active: path,
    }));
  }, []);

  const close = useCallback((path: string) => {
    setState((s) => {
      const idx = s.tabs.indexOf(path);
      const tabs = s.tabs.filter((t) => t !== path);
      let active = s.active;
      if (s.active === path) active = tabs[Math.min(idx, tabs.length - 1)] ?? null;
      return { tabs, active };
    });
  }, []);

  return { tabs: state.tabs, active: state.active, open, close };
}
