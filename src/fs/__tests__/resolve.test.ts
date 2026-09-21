import { describe, expect, it } from "vitest";
import { candidatePaths, resolveImport } from "../resolve";

const project = new Set([
  "/src/main.tsx",
  "/src/App.tsx",
  "/src/components/Button.tsx",
  "/src/components/Card/index.tsx",
  "/src/utils/math.ts",
  "/src/utils/math.js",
  "/src/data.json",
  "/src/Button.tsx.tsx",
]);
const exists = (p: string) => project.has(p);

describe("candidatePaths", () => {
  it("tries exact, then extensions, then index files", () => {
    expect(candidatePaths("/src/x")).toEqual([
      "/src/x",
      "/src/x.tsx",
      "/src/x.ts",
      "/src/x.jsx",
      "/src/x.js",
      "/src/x.json",
      "/src/x/index.tsx",
      "/src/x/index.ts",
      "/src/x/index.jsx",
      "/src/x/index.js",
      "/src/x/index.json",
    ]);
  });
});

describe("resolveImport", () => {
  it("resolves a sibling import without extension", () => {
    expect(resolveImport("./App", "/src/main.tsx", exists)).toEqual({
      kind: "file",
      path: "/src/App.tsx",
    });
  });

  it("resolves into a child folder", () => {
    expect(
      resolveImport("./components/Button", "/src/App.tsx", exists),
    ).toEqual({ kind: "file", path: "/src/components/Button.tsx" });
  });

  it("resolves a parent-relative import", () => {
    expect(
      resolveImport("../utils/math", "/src/components/Button.tsx", exists),
    ).toEqual({ kind: "file", path: "/src/utils/math.ts" });
  });

  it("prefers .ts over .js when both exist", () => {
    const r = resolveImport("./utils/math", "/src/App.tsx", exists);
    expect(r).toEqual({ kind: "file", path: "/src/utils/math.ts" });
  });

  it("falls back to an index file inside a folder", () => {
    expect(
      resolveImport("./components/Card", "/src/App.tsx", exists),
    ).toEqual({ kind: "file", path: "/src/components/Card/index.tsx" });
  });

  it("exact match wins over extension probing", () => {
    expect(resolveImport("./Button.tsx", "/src/App.tsx", exists)).toEqual({
      kind: "file",
      path: "/src/Button.tsx.tsx",
    });
  });

  it("resolves explicit extensions and json", () => {
    expect(resolveImport("./data.json", "/src/App.tsx", exists)).toEqual({
      kind: "file",
      path: "/src/data.json",
    });
  });

  it("treats a leading slash as project-root relative", () => {
    expect(
      resolveImport("/src/utils/math", "/src/components/Card/index.tsx", exists),
    ).toEqual({ kind: "file", path: "/src/utils/math.ts" });
  });

  it("resolves the entry point with an empty importer", () => {
    expect(resolveImport("/src/main.tsx", "", exists)).toEqual({
      kind: "file",
      path: "/src/main.tsx",
    });
  });

  it("marks bare specifiers as external", () => {
    expect(resolveImport("react", "/src/App.tsx", exists)).toEqual({
      kind: "external",
      path: "react",
    });
    expect(resolveImport("react-dom/client", "/src/main.tsx", exists)).toEqual({
      kind: "external",
      path: "react-dom/client",
    });
  });

  it("reports every path it tried when nothing matches", () => {
    const r = resolveImport("./Missing", "/src/App.tsx", exists);
    expect(r.kind).toBe("not-found");
    if (r.kind === "not-found") {
      expect(r.tried[0]).toBe("/src/Missing");
      expect(r.tried).toContain("/src/Missing/index.tsx");
    }
  });
});
