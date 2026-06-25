import { ICalCategory } from "ical-generator";
import {
  loadBuildingImgRules,
  loadGeoData,
  lookupLocationGeo,
} from "@/lib/location-utils";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

export type GeoData = Awaited<ReturnType<typeof loadGeoData>>;
export type ImgRules = Awaited<ReturnType<typeof loadBuildingImgRules>>;

export async function loadLocationAssets() {
  return Promise.all([loadGeoData(), loadBuildingImgRules()]);
}

export function parseTimeHHMM(date: Date, hhmm: number) {
  return shanghaiDayjs(date)
    .hour(Math.floor(hhmm / 100))
    .minute(hhmm % 100)
    .second(0);
}

export function toCategories(
  names: (string | null | undefined)[],
): ICalCategory[] {
  return names
    .filter((n) => n && n.trim() !== "")
    .map((n) => new ICalCategory({ name: n as string }));
}

export function buildLocationField(locationTitle: string, geoData: GeoData) {
  const geo = lookupLocationGeo(geoData, locationTitle);
  return {
    title: locationTitle,
    address: "",
    radius: 10,
    geo: geo ? { lat: geo.latitude, lon: geo.longitude } : undefined,
  };
}
