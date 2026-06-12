import { createStaticJsonLoader } from "@/lib/static-json-loader";
import type { GeoData, GeoLocation } from "@/lib/static-location-types";

const GEO_DATA_FILE = "geo_data.json";

/**
 * Loads geographic data from the published static host.
 * Exported for batch operations that pre-load data once and do synchronous lookups.
 */
export const loadGeoData = createStaticJsonLoader<GeoData>(GEO_DATA_FILE, {
  locations: [],
});

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
