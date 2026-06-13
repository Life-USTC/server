import "dotenv/config";
import { readFileSync } from "node:fs";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

function prismaCloudflareWasmModule(): Plugin {
  const wasmModuleImport = "./query_compiler_fast_bg.wasm?module";

  return {
    name: "prisma-cloudflare-wasm-module",
    enforce: "pre",
    resolveId(source, importer) {
      if (
        source === wasmModuleImport &&
        importer?.includes("/src/generated/prisma/internal/")
      ) {
        return { id: source, external: true };
      }
      return null;
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "chunks/query_compiler_fast_bg.wasm",
        source: readFileSync(
          "src/generated/prisma/internal/query_compiler_fast_bg.wasm",
        ),
      });
    },
  };
}

export default defineConfig({
  plugins: [prismaCloudflareWasmModule(), tailwindcss(), sveltekit()],
  ssr: {
    external: ["better-auth", "@better-auth/oauth-provider"],
  },
});
