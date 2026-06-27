import adapterCloudflare from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapterCloudflare(),
    csrf: {
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
