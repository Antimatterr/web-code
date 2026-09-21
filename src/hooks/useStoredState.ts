import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/** useState that survives reloads via localStorage. Falls back silently. */
export function useStoredState<T>(key: string, initial: T, validate?: (v: unknown) => v is T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (!validate || validate(parsed)) return parsed as T;
      }
    } catch {
      /* ignore */
    }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota or private mode; not fatal */
    }
  }, [key, value]);

  return [value, setValue] as [T, Dispatch<SetStateAction<T>>];
}
