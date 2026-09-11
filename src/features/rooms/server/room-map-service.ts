import { logAppEvent } from "@/lib/log/app-logger";
import {
  fetchLifeUstcStaticJson,
  getLifeUstcStaticUrl,
} from "@/lib/static-assets";
import {
  loadBuildingImgRules,
  lookupBuildingImagePath,
} from "@/shared/lib/location/static-building-images";
import type { BuildingImgRule } from "@/shared/lib/location/static-location-types";
import {
  type RoomMap,
  type RoomMapManifest,
  roomCodeSchema,
  roomMapManifestSchema,
} from "./room-map-schema";

export interface RoomMapAssets {
  manifest: RoomMapManifest;
  rules: BuildingImgRule[];
}
let cached: { manifest: RoomMapManifest; expires: number } | undefined;

async function loadRoomMapManifest(): Promise<RoomMapManifest> {
  if (cached && cached.expires > Date.now()) return cached.manifest;
  const raw = await fetchLifeUstcStaticJson<unknown>("room_maps.json", null);
  const parsed = roomMapManifestSchema.safeParse(raw);
  if (!parsed.success) {
    if (raw !== null)
      logAppEvent("warn", "Invalid room map manifest", {
        source: "life-ustc-static",
        pathname: "room_maps.json",
      });
    return { rooms: [] };
  }
  cached = { manifest: parsed.data, expires: Date.now() + 300_000 };
  return parsed.data;
}

export async function loadRoomMapAssets(): Promise<RoomMapAssets> {
  const [manifest, rules] = await Promise.all([
    loadRoomMapManifest(),
    loadBuildingImgRules(),
  ]);
  return { manifest, rules };
}

export function lookupRoomMap(input: string, assets: RoomMapAssets): RoomMap {
  const code = roomCodeSchema.parse(input);
  const room = assets.manifest.rooms.find((entry) => entry.code === code);
  if (room)
    return {
      code,
      building: room.building,
      floor: room.floor,
      status: "highlighted",
      imageUrl: getLifeUstcStaticUrl(room.imagePath),
      sourceImageUrl: getLifeUstcStaticUrl(room.sourceImagePath),
    };
  const imageUrl = lookupBuildingImagePath(assets.rules, code);
  return {
    code,
    building: null,
    floor: null,
    status: imageUrl ? "overview" : "unavailable",
    imageUrl,
    sourceImageUrl: imageUrl,
  };
}

export async function getRoomMap(input: string): Promise<RoomMap> {
  const code = roomCodeSchema.parse(input);
  return lookupRoomMap(code, await loadRoomMapAssets());
}
