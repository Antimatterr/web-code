import { useEffect, useRef, useState } from "react";
import type { BundleMessage } from "../bundler/types";
import type { FileMap } from "../fs/fileStore";
import { BundleFailure, bundlerService } from "../services/bundlerService";

export interface BundlerState {
  code: string;
  errors: BundleMessage[];
  warnings: BundleMessage[];
  isBundling: boolean;
}

const EMPTY: BundlerState = { code: "", errors: [], warnings: [], isBundling: false };

/**
 * Debounced project bundling. Re-runs whenever the file map changes.
 *
 * Staleness: every run takes a generation number. A response is applied only
 * if no newer run has started since, so fast typing can never let an older
 * bundle overwrite a newer one, regardless of the order the worker replies.
 */
export function useBundler(files: FileMap, entry: string, debounceMs = 300): BundlerState {
  const [state, setState] = useState<BundlerState>(EMPTY);
  const generation = useRef(0);

  useEffect(() => {
    const myGen = ++generation.current;
    const isCurrent = () => generation.current === myGen;

    const timer = setTimeout(async () => {
      if (files.size === 0) {
        setState(EMPTY);
        return;
      }

      setState((prev) => ({ ...prev, isBundling: true }));
      const snapshot = Object.fromEntries(files);

      try {
        const result = await bundlerService.bundle(entry, snapshot);
        if (!isCurrent()) return;
        setState({ code: result.code, errors: [], warnings: result.warnings, isBundling: false });
      } catch (err: unknown) {
        if (!isCurrent()) return;
        const errors: BundleMessage[] =
          err instanceof BundleFailure
            ? err.errors
            : [{ text: err instanceof Error ? err.message : "Bundle failed" }];
        // Keep the last good code so the preview does not blank out on a typo.
        setState((prev) => ({ ...prev, errors, warnings: [], isBundling: false }));
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [files, entry, debounceMs]);

  return state;
}
