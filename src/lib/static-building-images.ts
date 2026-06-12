import { getLifeUstcStaticUrl } from "@/lib/static-assets";
import { createStaticJsonLoader } from "@/lib/static-json-loader";
import type { BuildingImgRule } from "@/lib/static-location-types";

const BUILDING_IMG_RULES_FILE = "building_img_rules.json";

/**
 * Loads building image rules from the published static host.
 * Exported for batch operations that pre-load data once and do synchronous lookups.
 */
export const loadBuildingImgRules = createStaticJsonLoader<BuildingImgRule[]>(
  BUILDING_IMG_RULES_FILE,
  [],
);

/**
 * Finds the building image path based on room code.
 * Async version for one-off lookups.
 */
export async function getBuildingImagePath(
  roomCode: string,
): Promise<string | null> {
  if (!roomCode) return null;

  const rules = await loadBuildingImgRules();
  return lookupBuildingImagePath(rules, roomCode);
}

/**
 * Synchronous building image lookup from pre-loaded rules.
 * Use with `loadBuildingImgRules()` for batch operations to avoid repeated async overhead.
 */
export function lookupBuildingImagePath(
  rules: BuildingImgRule[],
  roomCode: string,
): string | null {
  if (!roomCode) return null;

  const rule = rules.find((r) => {
    try {
      const regex = new RegExp(`^${r.regex}$`);
      return regex.test(roomCode);
    } catch {
      return false;
    }
  });

  if (!rule) return null;

  if (/^https?:\/\//i.test(rule.path)) {
    return rule.path;
  }

  const imagePath = rule.path.replace("./imgs/", "");
  return getLifeUstcStaticUrl(`imgs/${imagePath}`);
}
