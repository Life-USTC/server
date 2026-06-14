import path from "node:path";

/** Path aliases shared by Vitest configs. SvelteKit owns editor aliases. */
export const sharedAlias = {
  "@/generated/prisma/client": path.resolve(
    __dirname,
    "src/generated/prisma-node/client",
  ),
  "@": path.resolve(__dirname, "src"),
  "@tools": path.resolve(__dirname, "tools"),
};
