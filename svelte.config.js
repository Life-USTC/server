import adapterCloudflare from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
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
    files: {
      assets: "public",
    },
  },
};

export default config;
