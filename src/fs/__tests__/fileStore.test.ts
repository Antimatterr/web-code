import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileStore, FileStoreError, type FileChange } from "../fileStore";
import { buildTree } from "../buildTree";

let store: FileStore;
let changes: FileChange[];

beforeEach(() => {
  store = new FileStore();
  changes = [];
  store.onChange((c) => changes.push(c));
  store.hydrate({
    "/src/main.tsx": "main",
    "/src/App.tsx": "app",
    "/src/components/Button.tsx": "button",
  });
  changes.length = 0;
});

describe("hydrate", () => {
  it("loads files as clean", () => {
    const snap = store.getSnapshot();
    expect(snap.files.size).toBe(3);
    expect(snap.dirty.size).toBe(0);
  });
});

describe("snapshot stability", () => {
  it("returns the same object until a mutation happens", () => {
    const a = store.getSnapshot();
    expect(store.getSnapshot()).toBe(a);
    store.updateFile("/src/App.tsx", "changed");
    expect(store.getSnapshot()).not.toBe(a);
  });

  it("does not bump the version for no-op updates", () => {
    const v = store.getSnapshot().version;
    store.updateFile("/src/App.tsx", "app");
    expect(store.getSnapshot().version).toBe(v);
    expect(changes).toEqual([]);
  });
});

describe("dirty tracking", () => {
  it("marks edited files dirty and clears on markSaved", () => {
    store.updateFile("/src/App.tsx", "v2");
    expect(store.getSnapshot().dirty.has("/src/App.tsx")).toBe(true);

    store.markSaved("/src/App.tsx", "v2");
    expect(store.getSnapshot().dirty.has("/src/App.tsx")).toBe(false);
  });

  it("stays dirty if content changed again before the write landed", () => {
    store.updateFile("/src/App.tsx", "v2");
    store.updateFile("/src/App.tsx", "v3");
    store.markSaved("/src/App.tsx", "v2");
    expect(store.getSnapshot().dirty.has("/src/App.tsx")).toBe(true);
  });
});

describe("createFile", () => {
  it("creates and emits", () => {
    store.createFile("/src/utils/math.ts", "export const x = 1");
    expect(store.read("/src/utils/math.ts")).toBe("export const x = 1");
    expect(changes).toEqual([
      { type: "create", path: "/src/utils/math.ts", content: "export const x = 1" },
    ]);
    expect(store.getSnapshot().dirty.has("/src/utils/math.ts")).toBe(true);
  });

  it("rejects duplicates, invalid paths, and folder collisions", () => {
    expect(() => store.createFile("/src/App.tsx")).toThrow(FileStoreError);
    expect(() => store.createFile("src/x.ts")).toThrow(FileStoreError);
    expect(() => store.createFile("/src/../x.ts")).toThrow(FileStoreError);
    expect(() => store.createFile("/src/components")).toThrow(FileStoreError);
  });
});

describe("folders", () => {
  it("creates an explicit empty folder that appears in the tree", () => {
    store.createFolder("/src/hooks");
    expect(store.isFolder("/src/hooks")).toBe(true);
    const tree = buildTree(store.getSnapshot().files, store.getSnapshot().folders);
    const src = tree.find((n) => n.name === "src")!;
    expect(src.children!.map((c) => c.name)).toEqual([
      "components",
      "hooks",
      "App.tsx",
      "main.tsx",
    ]);
  });

  it("drops the explicit entry once a file lives inside it", () => {
    store.createFolder("/src/hooks");
    store.createFile("/src/hooks/useX.ts");
    expect(store.getSnapshot().folders.has("/src/hooks")).toBe(false);
    expect(store.isFolder("/src/hooks")).toBe(true);
  });
});

describe("delete", () => {
  it("deletes a single file", () => {
    store.delete("/src/App.tsx");
    expect(store.has("/src/App.tsx")).toBe(false);
    expect(changes).toEqual([{ type: "delete", path: "/src/App.tsx", isFolder: false }]);
  });

  it("deletes a folder recursively without touching siblings", () => {
    store.createFile("/src/components/Card/index.tsx");
    store.createFile("/src/componentsX.ts");
    changes.length = 0;

    store.delete("/src/components");
    expect(store.has("/src/components/Button.tsx")).toBe(false);
    expect(store.has("/src/components/Card/index.tsx")).toBe(false);
    expect(store.has("/src/componentsX.ts")).toBe(true);
    expect(changes).toEqual([{ type: "delete", path: "/src/components", isFolder: true }]);
  });

  it("throws for unknown paths", () => {
    expect(() => store.delete("/nope")).toThrow(FileStoreError);
  });
});

describe("rename", () => {
  it("renames a file and marks the new path dirty", () => {
    store.rename("/src/App.tsx", "/src/Root.tsx");
    expect(store.has("/src/App.tsx")).toBe(false);
    expect(store.read("/src/Root.tsx")).toBe("app");
    expect(store.getSnapshot().dirty.has("/src/Root.tsx")).toBe(true);
    expect(changes).toEqual([
      { type: "rename", from: "/src/App.tsx", to: "/src/Root.tsx", isFolder: false },
    ]);
  });

  it("renames a folder and re-keys descendants", () => {
    store.createFile("/src/components/Card/index.tsx");
    store.rename("/src/components", "/src/ui");
    expect(store.has("/src/ui/Button.tsx")).toBe(true);
    expect(store.has("/src/ui/Card/index.tsx")).toBe(true);
    expect(store.isFolder("/src/components")).toBe(false);
  });

  it("refuses to clobber or nest into itself", () => {
    expect(() => store.rename("/src/App.tsx", "/src/main.tsx")).toThrow(FileStoreError);
    expect(() => store.rename("/src/components", "/src/components/inner")).toThrow(
      FileStoreError,
    );
    expect(() => store.rename("/src/App.tsx", "/src/components")).toThrow(FileStoreError);
  });
});

describe("subscribe", () => {
  it("notifies plain listeners after every commit and supports unsubscribe", () => {
    const fn = vi.fn();
    const off = store.subscribe(fn);
    store.updateFile("/src/App.tsx", "x");
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    store.updateFile("/src/App.tsx", "y");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
