import adapterCloudflare from "@sveltejs/adapter-cloudflare";
import adapterNode from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const useNodeAdapter = process.env.SVELTEKIT_ADAPTER === "node";
const trustedOrigins = [
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "https://cf.life-ustc.tiankaima.dev",
  "https://life-ustc.tiankaima.dev",
  process.env.APP_PUBLIC_ORIGIN,
].filter(Boolean);

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: useNodeAdapter ? adapterNode() : adapterCloudflare(),
    csrf: {
      trustedOrigins,
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
