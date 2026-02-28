import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // Prevent Vite from trying to pre-bundle esbuild-wasm
    exclude: ["esbuild-wasm"],
  },
  server: {
    headers: {
      // Required for SharedArrayBuffer (Monaco uses it)
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  worker: {
    format: "es", // Use ES module format for workers
  },
});
