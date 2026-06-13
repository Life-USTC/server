import "dotenv/config";
import { copyFileSync, mkdirSync } from "node:fs";
import { basename, dirname } from "node:path";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

function prismaWasmModulePlugin() {
  const wasmFile = "query_compiler_fast_bg.wasm";
  const wasmModuleSuffix = `${wasmFile}?module`;
  let resolvedWasmPath: string | null = null;

  return {
    name: "prisma-wasm-module",
    enforce: "pre" as const,
    resolveId(source: string, importer?: string) {
      if (!source.endsWith(wasmModuleSuffix)) return null;
      resolvedWasmPath = importer
        ? new URL(source.slice(0, -"?module".length), `file://${importer}`)
            .pathname
        : source.slice(0, -"?module".length);
      return { id: source, external: true };
    },
    generateBundle() {
      if (!resolvedWasmPath) return;
      const outputPath = `.svelte-kit/output/server/chunks/${basename(
        resolvedWasmPath,
      )}`;
      mkdirSync(dirname(outputPath), { recursive: true });
      copyFileSync(resolvedWasmPath, outputPath);
    },
  };
}

export default defineConfig({
  plugins: [prismaWasmModulePlugin(), tailwindcss(), sveltekit()],
  ssr: {
    resolve: {
      conditions: ["cloudflare"],
    },
    external: ["better-auth", "@better-auth/oauth-provider"],
  },
});
