import path from "node:path";

/** Path aliases shared by Vitest configs. SvelteKit owns editor aliases. */
export const sharedAlias = {
  "@": path.resolve(__dirname, "src"),
  "@tools": path.resolve(__dirname, "tools"),
};
