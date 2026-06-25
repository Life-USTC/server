export interface GeoLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface GeoData {
  locations: GeoLocation[];
}

export interface BuildingImgRule {
  regex: string;
  path: string;
}
