import "dotenv/config";
import { copyFileSync, mkdirSync } from "node:fs";
import { basename, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rollupWasm } from "@ethercorps/sveltekit-og/plugin";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

const PRISMA_WASM_VIRTUAL_ID = "\0life-ustc:prisma-wasm-module";

function prismaDevWasmModuleSource(wasmPath: string) {
  return [
    'import { readFileSync } from "node:fs";',
    `export default new WebAssembly.Module(readFileSync(${JSON.stringify(wasmPath)}));`,
  ].join("\n");
}

function resolvePrismaWasmPath(source: string, importer?: string) {
  const withoutQuery = source.slice(0, -"?module".length);
  if (!importer) return withoutQuery;
  return fileURLToPath(new URL(withoutQuery, pathToFileURL(importer)));
}

export function prismaWasmModulePlugin(command: "build" | "serve"): Plugin {
  const wasmFile = "query_compiler_fast_bg.wasm";
  const wasmModuleSuffix = `${wasmFile}?module`;
  let resolvedWasmPath: string | null = null;

  return {
    name: "prisma-wasm-module",
    enforce: "pre" as const,
    resolveId(source: string, importer?: string) {
      if (!source.endsWith(wasmModuleSuffix)) return null;
      resolvedWasmPath = resolvePrismaWasmPath(source, importer);
      if (command === "serve") {
        return PRISMA_WASM_VIRTUAL_ID;
      }
      return { id: `${resolvedWasmPath}?module`, external: true };
    },
    load(id: string) {
      return id === PRISMA_WASM_VIRTUAL_ID && resolvedWasmPath
        ? prismaDevWasmModuleSource(resolvedWasmPath)
        : null;
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

export default defineConfig(({ command }) => ({
  build: {
    assetsInlineLimit: assetInlineDecision,
  },
  plugins: [
    prismaWasmModulePlugin(command),
    katexModernFontsPlugin(),
    rollupWasm(),
    tailwindcss(),
    sveltekit(),
  ],
  ssr: {
    resolve: {
      conditions:
        command === "serve" ? ["node", "development"] : ["cloudflare"],
    },
    external: [
      "better-auth",
      "@better-auth/oauth-provider",
      "@better-auth/mcp",
      "@better-auth/cimd",
    ],
  },
}));
