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

const KATEX_LEGACY_FONT_SOURCES =
  /,url\(([^)]*\.woff)\) format\("woff"\),url\(([^)]*\.ttf)\) format\("truetype"\)/g;

export function keepModernKatexFontSources(css: string) {
  return css.replace(KATEX_LEGACY_FONT_SOURCES, "");
}

function katexModernFontsPlugin() {
  return {
    name: "katex-modern-fonts",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!id.includes("/katex/dist/katex.min.css")) return null;
      const transformed = keepModernKatexFontSources(code);
      return transformed === code ? null : { code: transformed, map: null };
    },
  };
}

const FONT_ASSET_PATTERN = /\.(?:eot|otf|ttf|woff2?)(?:\?.*)?$/i;

export function assetInlineDecision(filePath: string) {
  return FONT_ASSET_PATTERN.test(filePath) ? false : undefined;
}

export default defineConfig({
  build: {
    assetsInlineLimit: assetInlineDecision,
  },
  plugins: [
    prismaWasmModulePlugin(),
    katexModernFontsPlugin(),
    tailwindcss(),
    sveltekit(),
  ],
  ssr: {
    resolve: {
      conditions: ["cloudflare"],
    },
    external: ["better-auth", "@better-auth/oauth-provider"],
  },
});
