import { dirname, isRelativeSpecifier, join } from "./pathUtils";

/** Extensions probed, in order, when an import omits one. */
export const RESOLVE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".json"] as const;

/** Predicate the resolver uses to ask "does this file exist?". */
export type FileExists = (path: string) => boolean;

export type ResolveResult =
  | { kind: "file"; path: string }
  | { kind: "external"; path: string }
  | { kind: "not-found"; tried: string[] };

/**
 * Build the ordered list of concrete paths an import specifier could mean.
 *
 *   ./Button      -> ./Button, ./Button.tsx, ./Button.ts, ..., ./Button/index.tsx, ...
 *   ./Button.tsx  -> ./Button.tsx, ./Button.tsx.tsx, ... (exact match wins first)
 */
export function candidatePaths(base: string): string[] {
  const out = [base];
  for (const ext of RESOLVE_EXTENSIONS) out.push(base + ext);
  for (const ext of RESOLVE_EXTENSIONS) out.push(join(base, "index" + ext));
  return out;
}

/**
 * Resolve an import specifier the way a Node/bundler-style resolver would,
 * against a virtual file map instead of a disk.
 *
 * @param specifier  Raw string from the import statement.
 * @param importer   Absolute path of the file containing the import
 *                   ("" for the entry point).
 * @param exists     Lookup into the project file map.
 */
export function resolveImport(
  specifier: string,
  importer: string,
  exists: FileExists,
): ResolveResult {
  if (!isRelativeSpecifier(specifier)) {
    return { kind: "external", path: specifier };
  }

  const base = specifier.startsWith("/")
    ? join(specifier)
    : join(importer ? dirname(importer) : "/", specifier);

  const tried = candidatePaths(base);
  for (const candidate of tried) {
    if (exists(candidate)) return { kind: "file", path: candidate };
  }
  return { kind: "not-found", tried };
}
