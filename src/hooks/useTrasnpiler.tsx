import { useEffect, useRef, useState } from "react";
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

  const timeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timeRef.current) {
      clearTimeout(timeRef.current);
    }
    if (!code.trim()) {
      return;
    }

    setState((prev) => ({ ...prev, isCompiling: true, error: null }));

    timeRef.current = setTimeout(async () => {
      try {
        const output = await esbuildService.transpile(code);
        setState({ output, error: null, isCompiling: false });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Transpile failed";
        setState({ output: "", error: message, isCompiling: false });
      }
    }, debounceMs);
    return () => {
      if (timeRef.current) {
        clearTimeout(timeRef.current);
      }
    };
  }, [code, debounceMs]);
  return state;
}
