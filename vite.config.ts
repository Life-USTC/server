import adapterCloudflare from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import "dotenv/config";
import { copyFileSync, mkdirSync } from "node:fs";
import { basename, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

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

export function prismaWasmModulePlugin(command: "build" | "serve") {
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
      // Keep the import beside the compiler chunk, where generateBundle copies it.
      return { id: `./${wasmModuleSuffix}`, external: true };
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

// Cloudflare Workers Builds exposes the commit it is building. Naming the app
// version after that commit makes the version SvelteKit already publishes at
// `/_app/version.json` state which main commit the live deployment was built
// from, which is what deployment-ordering verification compares against the
// newest successfully built main commit. Builds without the variable keep
// SvelteKit's build-time default.
const BUILD_COMMIT_ENV = "WORKERS_CI_COMMIT_SHA";

export function resolveAppVersionName(
  environment: Record<string, string | undefined>,
  fallback: () => string = () => Date.now().toString(),
) {
  const commit = environment[BUILD_COMMIT_ENV]?.trim();
  return commit && /^[0-9a-f]{40}$/.test(commit) ? commit : fallback();
}

export default defineConfig(({ command }) => ({
  build: {
    assetsInlineLimit: assetInlineDecision,
  },
  environments: {
    client: {
      build: {
        rolldownOptions: {
          output: {
            codeSplitting: {
              groups: [
                {
                  // Collection pages share these layout and filter wrappers;
                  // bundle them together to avoid a request per small component.
                  name: "collection-primitives",
                  test: /[\\/]src[\\/]lib[\\/]components[\\/](?:CollectionEmpty\.svelte|MobileListCard\.svelte|ResponsiveCollection\.svelte|collection-responsive-breakpoint\.ts|PageLayout\.svelte|SearchField\.svelte|FilterToolbar\.svelte)$/,
                },
              ],
            },
          },
        },
      },
    },
  },
  plugins: [
    prismaWasmModulePlugin(command),
    katexModernFontsPlugin(),
    tailwindcss(),
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapterCloudflare({
        config: "wrangler.adapter.jsonc",
        platformProxy: { configPath: "wrangler.dev.jsonc" },
      }),

      csrf: {
        // OAuth token and device endpoints accept cross-origin form requests. The
        // production hook in src/hooks.server.ts is the single CSRF gate so it can
        // exempt only those endpoints while rejecting cross-site forms elsewhere.
        trustedOrigins: ["*"],
      },
      alias: {
        // Always the Cloudflare/wasm client. Vitest aliases to prisma-node in
        // vitest.base.ts; CLI/scripts import prisma-node directly. A NODE_ENV-based
        // switch here broke E2E: per-shard `app:prepare` rewrote the Kit alias to
        // prisma-node and wrangler rebundled that into the worker.
        "@/generated/prisma/client": "./src/generated/prisma/client",
        "@/*": "./src/*",
      },
      files: { assets: "public" },
      version: { name: resolveAppVersionName(process.env) },
    }),
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
