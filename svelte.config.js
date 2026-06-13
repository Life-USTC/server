import adapterCloudflare from "@sveltejs/adapter-cloudflare";
import adapterNode from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const useNodeAdapter = process.env.SVELTEKIT_ADAPTER === "node";
/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: useNodeAdapter ? adapterNode() : adapterCloudflare(),
    csrf: {
      checkOrigin: false,
    },
    alias: {
      "@/generated/prisma/client": useNodeAdapter
        ? "./src/generated/prisma-node/client"
        : "./src/generated/prisma/client",
      "@/*": "./src/*",
      "@tools/*": "./tools/*",
    },
    files: {
      assets: "public",
    },
  },
};

export default config;
