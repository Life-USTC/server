import type {
  RoomMapBuilding,
  RoomMapFloor,
} from "@/features/rooms/lib/room-map-types";
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

const compareFloors = (left: RoomMapFloor, right: RoomMapFloor) =>
  Number(left.floor) - Number(right.floor) ||
  left.floor.localeCompare(right.floor);

/**
 * Buildings and floors covered by the room-map manifest, so the lookup page can
 * be browsed before a code is known. Reuses the manifest the lookup itself reads.
 */
export async function listRoomMapBuildings(): Promise<RoomMapBuilding[]> {
  const manifest = await loadRoomMapManifest();
  const buildings = new Map<string, Map<string, string[]>>();
  for (const room of manifest.rooms) {
    const floors = buildings.get(room.building) ?? new Map<string, string[]>();
    buildings.set(room.building, floors);
    floors.set(room.floor, [...(floors.get(room.floor) ?? []), room.code]);
  }

  return [...buildings]
    .map(([building, floors]) => ({
      building,
      floors: [...floors]
        .map(([floor, codes]) => ({
          floor,
          codes: [...codes].sort((left, right) => left.localeCompare(right)),
        }))
        .sort(compareFloors),
      roomCount: [...floors.values()].reduce(
        (total, codes) => total + codes.length,
        0,
      ),
    }))
    .sort(
      (left, right) =>
        right.roomCount - left.roomCount ||
        left.building.localeCompare(right.building),
    );
}

export async function getRoomMap(input: string): Promise<RoomMap> {
  const code = roomCodeSchema.parse(input);
  return lookupRoomMap(code, await loadRoomMapAssets());
}
