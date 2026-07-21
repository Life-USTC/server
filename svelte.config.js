import adapterCloudflare from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapterCloudflare(),
    csrf: {
      // OAuth token and device endpoints accept cross-origin form requests. The
      // production hook in src/hooks.server.ts is the single CSRF gate so it can
      // exempt only those endpoints while rejecting cross-site forms elsewhere.
      trustedOrigins: ["*"],
    },
    alias: {
      "@/generated/prisma/client": "./src/generated/prisma/client",
      "@/*": "./src/*",
    },
    files: {
      assets: "public",
    },
  },
};

export default config;
