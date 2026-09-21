import { useSyncExternalStore } from "react";
import { persistence } from "../fs/persistence";

interface PersistenceStatus {
  isSaving: boolean;
  error: string | null;
}

let cached: PersistenceStatus = { isSaving: false, error: null };

function getSnapshot(): PersistenceStatus {
  const next = { isSaving: persistence.isSaving, error: persistence.error };
  if (next.isSaving !== cached.isSaving || next.error !== cached.error) cached = next;
  return cached;
}

const subscribe = (cb: () => void) => persistence.subscribe(cb);

export function usePersistenceStatus(): PersistenceStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
