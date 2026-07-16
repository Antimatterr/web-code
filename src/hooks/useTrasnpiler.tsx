import { useEffect, useState } from "react";
import { esbuildService } from "../services/esbuildService";

interface TranspilerState {
  output: string;
  error: string | null;
  isCompiling: boolean;
}

export function useTranspiler(code: string, debounceMs = 300) {
  const [state, setState] = useState<TranspilerState>({
    output: "",
    error: null,
    isCompiling: false,
  });

  useEffect(() => {
    let isCancelled = false;

    const timerId = setTimeout(async () => {
      if (!code.trim()) {
        if (!isCancelled) {
          setState({ output: "", error: null, isCompiling: false });
        }
        return;
      }

      if (!isCancelled) {
        setState((prev) => ({ ...prev, isCompiling: true, error: null }));
      }

      try {
        const output = await esbuildService.transpile(code);
        if (!isCancelled) {
          setState({ output, error: null, isCompiling: false });
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const message = err instanceof Error ? err.message : "Transpile failed";
          setState({ output: "", error: message, isCompiling: false });
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timerId);
      isCancelled = true;
    };
  }, [code, debounceMs]);

  return state;
}