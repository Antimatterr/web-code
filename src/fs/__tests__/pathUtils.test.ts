import { describe, expect, it } from "vitest";
import {
  basename,
  dirname,
  extname,
  isInside,
  isRelativeSpecifier,
  join,
  normalizePath,
  validatePath,
} from "../pathUtils";

describe("normalizePath", () => {
  it("forces a leading slash and collapses duplicates", () => {
    expect(normalizePath("src//App.tsx")).toBe("/src/App.tsx");
    expect(normalizePath("/src/./App.tsx")).toBe("/src/App.tsx");
  });
  it("resolves .. segments and never escapes the root", () => {
    expect(normalizePath("/src/pages/../components/Button")).toBe(
      "/src/components/Button",
    );
    expect(normalizePath("/../../etc/passwd")).toBe("/etc/passwd");
  });
  it("returns / for empty input", () => {
    expect(normalizePath("")).toBe("/");
  });
});

describe("dirname / basename / extname", () => {
  it("splits a nested path", () => {
    expect(dirname("/src/components/Button.tsx")).toBe("/src/components");
    expect(basename("/src/components/Button.tsx")).toBe("Button.tsx");
    expect(extname("/src/components/Button.tsx")).toBe(".tsx");
  });
  it("handles root-level files", () => {
    expect(dirname("/main.tsx")).toBe("/");
    expect(dirname("/")).toBe("/");
  });
  it("uses only the last extension and ignores dotfiles", () => {
    expect(extname("/a/b.test.tsx")).toBe(".tsx");
    expect(extname("/a/.gitignore")).toBe("");
    expect(extname("/a/Makefile")).toBe("");
  });
});

describe("join", () => {
  it("joins and normalizes", () => {
    expect(join("/src", "../lib", "x.ts")).toBe("/lib/x.ts");
    expect(join("/src/components", "index.tsx")).toBe(
      "/src/components/index.tsx",
    );
  });
});

describe("isRelativeSpecifier", () => {
  it("detects relative and absolute project paths", () => {
    expect(isRelativeSpecifier("./a")).toBe(true);
    expect(isRelativeSpecifier("../a")).toBe(true);
    expect(isRelativeSpecifier("/src/a")).toBe(true);
  });
  it("treats bare and scoped packages as non-relative", () => {
    expect(isRelativeSpecifier("react")).toBe(false);
    expect(isRelativeSpecifier("@tanstack/query")).toBe(false);
    expect(isRelativeSpecifier("react-dom/client")).toBe(false);
  });
});

describe("isInside", () => {
  it("matches the folder itself and descendants only", () => {
    expect(isInside("/src", "/src")).toBe(true);
    expect(isInside("/src", "/src/App.tsx")).toBe(true);
    expect(isInside("/src", "/srcx/App.tsx")).toBe(false);
    expect(isInside("/", "/anything")).toBe(true);
  });
});

describe("validatePath", () => {
  it("accepts ordinary paths", () => {
    expect(validatePath("/src/App.tsx")).toBeNull();
    expect(validatePath("/src/@scoped/some-file_v2.ts")).toBeNull();
  });
  it("rejects traversal and malformed paths", () => {
    expect(validatePath("src/App.tsx")).not.toBeNull();
    expect(validatePath("/src/../App.tsx")).not.toBeNull();
    expect(validatePath("/src//App.tsx")).not.toBeNull();
    expect(validatePath("/src/")).not.toBeNull();
    expect(validatePath("/")).not.toBeNull();
    expect(validatePath("/src/bad name.tsx")).not.toBeNull();
  });
});
