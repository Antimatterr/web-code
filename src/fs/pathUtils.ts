/**
 * POSIX-style path helpers for the virtual project filesystem.
 *
 * Every path inside the project is absolute and rooted at "/", e.g.
 * "/src/App.tsx". Nothing here touches the real filesystem; these are pure
 * string functions so they can be unit-tested and shared between the main
 * thread and workers.
 */

/** Collapse "." and ".." segments, duplicate slashes, and force a leading "/". */
export function normalizePath(input: string): string {
  const segments: string[] = [];
  for (const part of input.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      segments.pop();
      continue;
    }
    segments.push(part);
  }
  return "/" + segments.join("/");
}

export function dirname(path: string): string {
  const normalized = normalizePath(path);
  const idx = normalized.lastIndexOf("/");
  return idx <= 0 ? "/" : normalized.slice(0, idx);
}

export function basename(path: string): string {
  const normalized = normalizePath(path);
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

/** Extension including the dot ("/a/b.test.tsx" -> ".tsx"), or "" if none. */
export function extname(path: string): string {
  const name = basename(path);
  const idx = name.lastIndexOf(".");
  return idx <= 0 ? "" : name.slice(idx);
}

export function join(...parts: string[]): string {
  return normalizePath(parts.join("/"));
}

/** True for "./x", "../x" and "/x". Anything else is a bare (package) import. */
export function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("/") ||
    specifier === "." ||
    specifier === ".."
  );
}

/** True if `child` is `parent` itself or lives somewhere underneath it. */
export function isInside(parent: string, child: string): boolean {
  const p = normalizePath(parent);
  const c = normalizePath(child);
  if (p === "/") return true;
  return c === p || c.startsWith(p + "/");
}

const SEGMENT_RE = /^[A-Za-z0-9._@-]+$/;

/**
 * Validate a user-supplied project path. Returns an error message or null.
 * Rejects traversal, empty segments, and characters that are awkward in URLs
 * and OPFS names.
 */
export function validatePath(path: string): string | null {
  if (!path.startsWith("/")) return "Path must start with '/'";
  if (path === "/") return "Path cannot be the root";
  if (path.endsWith("/")) return "Path cannot end with '/'";
  for (const segment of path.slice(1).split("/")) {
    if (segment === "" || segment === "." || segment === "..") {
      return `Invalid path segment "${segment}"`;
    }
    if (!SEGMENT_RE.test(segment)) {
      return `Invalid characters in "${segment}"`;
    }
  }
  return null;
}
