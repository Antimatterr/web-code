import { useSyncExternalStore } from "react";
import { fileStore, type FileStoreSnapshot } from "../fs/fileStore";

const subscribe = (cb: () => void) => fileStore.subscribe(cb);
const getSnapshot = () => fileStore.getSnapshot();

/** Subscribe a component to the project filesystem. Re-renders on any change. */
export function useFileStore(): FileStoreSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
