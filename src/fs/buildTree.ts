import type { FileMap } from "./fileStore";

export interface TreeNode {
  name: string;
  path: string;
  kind: "file" | "folder";
  children?: TreeNode[];
}

/**
 * Derive a sorted tree from the flat file map plus explicit (possibly empty)
 * folders. Folders sort before files; both alphabetical, case-insensitive.
 */
export function buildTree(files: FileMap, folders: ReadonlySet<string>): TreeNode[] {
  const root: TreeNode = { name: "", path: "/", kind: "folder", children: [] };
  const byPath = new Map<string, TreeNode>([["/", root]]);

  const ensureFolder = (path: string): TreeNode => {
    const existing = byPath.get(path);
    if (existing) return existing;
    const idx = path.lastIndexOf("/");
    const parentPath = idx <= 0 ? "/" : path.slice(0, idx);
    const parent = ensureFolder(parentPath);
    const node: TreeNode = {
      name: path.slice(idx + 1),
      path,
      kind: "folder",
      children: [],
    };
    parent.children!.push(node);
    byPath.set(path, node);
    return node;
  };

  for (const folder of folders) ensureFolder(folder);

  for (const path of files.keys()) {
    const idx = path.lastIndexOf("/");
    const parent = ensureFolder(idx <= 0 ? "/" : path.slice(0, idx));
    parent.children!.push({ name: path.slice(idx + 1), path, kind: "file" });
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    for (const n of nodes) if (n.children) sortNodes(n.children);
  };
  sortNodes(root.children!);
  return root.children!;
}
