import type { LayoutServerLoad } from "./$types";

/** Public presentation metadata; no viewer data or route-string inference. */
export const load: LayoutServerLoad = () => ({
  shellTemplate: "academic-detail" as const,
  shellDetail: "section" as const,
});
