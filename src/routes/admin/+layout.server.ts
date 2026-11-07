import type { LayoutServerLoad } from "./$types";

/** Public presentation metadata; no viewer data or route-string inference. */
export const load: LayoutServerLoad = () => ({
  shellTemplate: "workspace" as const,
});
