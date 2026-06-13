import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    csrf: {
      trustedOrigins: ["*"],
    },
    alias: {
      "@/*": "./src/*",
      "@tools/*": "./tools/*",
    },
    files: {
      assets: "public",
    },
  },
};

export default config;
