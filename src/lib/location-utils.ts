import {
  fetchLifeUstcStaticJson,
  getLifeUstcStaticUrl,
} from "@/lib/static-assets";

/**
 * Minimal shape for schedule location formatting.
 * Compatible with both Prisma-selected and client-fetched schedules.
 */
export type ScheduleLocationInfo = {
  customPlace: string | null;
  room: {
    namePrimary: string;
    building: {
      namePrimary: string;
      campus: { namePrimary: string } | null;
    } | null;
  } | null;
};

/**
 * Formats a schedule's location string from room → building → campus.
 */
export function formatScheduleLocation(schedule: ScheduleLocationInfo): string {
  if (schedule.customPlace) return schedule.customPlace;
  if (!schedule.room) return "—";

  const parts = [schedule.room.namePrimary];
  if (schedule.room.building) {
    parts.push(schedule.room.building.namePrimary);
    if (schedule.room.building.campus) {
      parts.push(schedule.room.building.campus.namePrimary);
    }
  }

  return parts.join(" · ");
}

interface GeoLocation {
  name: string;
  latitude: number;
  longitude: number;
}

interface GeoData {
  locations: GeoLocation[];
}

interface BuildingImgRule {
  regex: string;
  path: string;
}

const GEO_DATA_FILE = "geo_data.json";
const BUILDING_IMG_RULES_FILE = "building_img_rules.json";

function createStaticJsonLoader<T>(pathname: string, fallback: T) {
  let cached: T | null = null;

  return async () => {
    if (cached !== null) return cached;
    cached = await fetchLifeUstcStaticJson(pathname, fallback);
    return cached;
  };
}

/**
 * Loads geographic data from the published static host.
 * Exported for batch operations that pre-load data once and do synchronous lookups.
 */
export const loadGeoData = createStaticJsonLoader<GeoData>(GEO_DATA_FILE, {
  locations: [],
});

/**
 * Loads building image rules from the published static host.
 * Exported for batch operations that pre-load data once and do synchronous lookups.
 */
export const loadBuildingImgRules = createStaticJsonLoader<BuildingImgRule[]>(
  BUILDING_IMG_RULES_FILE,
  [],
);

function normalizeGeoLocationName(location: GeoLocation) {
  return location.name.toLowerCase();
}

/**
 * Finds geographic coordinates for a location by name.
 * Async version for one-off lookups.
 */
export async function getLocationGeo(
  locationName: string,
): Promise<GeoLocation | null> {
  if (!locationName) return null;

  const geoData = await loadGeoData();
  return lookupLocationGeo(geoData, locationName);
}

/**
 * Synchronous geo lookup from pre-loaded data.
 * Use with `loadGeoData()` for batch operations to avoid repeated async overhead.
 */
export function lookupLocationGeo(
  geoData: GeoData,
  locationName: string,
): GeoLocation | null {
  if (!locationName) return null;

  const normalizedLocationName = locationName.toLowerCase();
  const location = geoData.locations.find(
    (loc) => normalizeGeoLocationName(loc) === normalizedLocationName,
  );
  return (
    location ??
    geoData.locations.find((loc) =>
      normalizedLocationName.startsWith(normalizeGeoLocationName(loc)),
    ) ??
    null
  );
}

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

  // Convert relative path to absolute URL
  const imagePath = rule.path.replace("./imgs/", "");
  return getLifeUstcStaticUrl(`imgs/${imagePath}`);
}
