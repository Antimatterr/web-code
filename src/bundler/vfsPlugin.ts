import type { Loader, Plugin } from "esbuild-wasm/esm/browser";
import { extname } from "../fs/pathUtils";
import { resolveImport } from "../fs/resolve";

export const VFS_NAMESPACE = "vfs";

const LOADERS: Record<string, Loader> = {
  ".tsx": "tsx",
  ".ts": "ts",
  ".jsx": "jsx",
  ".js": "js",
  ".json": "json",
};

/**
 * esbuild plugin that serves modules from an in-memory file map instead of a
 * real disk.
 *
 * - Relative / project-absolute imports are resolved with the shared
 *   `resolveImport` rules and loaded from `files`.
 * - Bare imports ("react", "lodash") are marked external. They survive in the
 *   output as plain `import` statements and are satisfied at runtime by the
 *   preview iframe's import map.
 */
export function vfsPlugin(files: Record<string, string>): Plugin {
  const exists = (p: string) => Object.prototype.hasOwnProperty.call(files, p);

  return {
    name: "vfs",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const importer = args.kind === "entry-point" ? "" : args.importer;
        const result = resolveImport(args.path, importer, exists);

        switch (result.kind) {
          case "external":
            return { path: result.path, external: true };
          case "file":
            return { path: result.path, namespace: VFS_NAMESPACE };
          case "not-found": {
            const from = importer ? ` from "${importer}"` : "";
            return {
              errors: [
                {
                  text: `Cannot find module "${args.path}"${from}`,
                  detail: result.tried,
                },
              ],
            };
          }
        }
      });

      build.onLoad({ filter: /.*/, namespace: VFS_NAMESPACE }, (args) => {
        const ext = extname(args.path);
        const loader = LOADERS[ext];
        if (!loader) {
          return {
            errors: [
              {
                text: `Unsupported file type "${ext || "(none)"}" for "${args.path}". ` +
                  `Only ${Object.keys(LOADERS).join(", ")} can be imported right now.`,
              },
            ],
          };
        }
        return { contents: files[args.path], loader };
      });
    },
  };
}
