import type { CampusOccurrence } from "./campus-selection";
import type {
  BuildingBuild,
  CampusBuild,
  RoomBuild,
  RoomTypeBuild,
} from "./mappers";

export type RoomOccurrence = {
  semesterCode: number;
  room: RoomBuild;
  building?: BuildingBuild;
  campus?: CampusBuild;
  roomType?: RoomTypeBuild;
};

export type RoomTypeOccurrence = {
  semesterCode: number;
  roomType: RoomTypeBuild;
};

export function selectLatestRoomInfrastructure(
  occurrences: Iterable<RoomOccurrence>,
  supplementalRoomTypes: readonly RoomTypeOccurrence[] = [],
) {
  const rooms = new Map<number, RoomOccurrence>();
  const buildings = new Map<
    number,
    RoomOccurrence & { building: BuildingBuild }
  >();
  const roomTypes = new Map<number, RoomTypeOccurrence>();
  for (const occurrence of occurrences) {
    const { room, building, roomType } = occurrence;
    // Keep each authoritative record whole, including intentional empty fields.
    if (isNewer(occurrence, rooms.get(room.jwId)))
      rooms.set(room.jwId, occurrence);
    // Repeated rooms can still carry newer shared building/type metadata.
    if (building != null && isNewer(occurrence, buildings.get(building.jwId))) {
      buildings.set(building.jwId, { ...occurrence, building });
    }
    const typeOccurrence =
      roomType == null
        ? undefined
        : {
            semesterCode: occurrence.semesterCode,
            roomType,
          };
    if (
      typeOccurrence != null &&
      isNewer(typeOccurrence, roomTypes.get(typeOccurrence.roomType.jwId))
    ) {
      roomTypes.set(typeOccurrence.roomType.jwId, typeOccurrence);
    }
  }
  for (const occurrence of supplementalRoomTypes) {
    if (isNewer(occurrence, roomTypes.get(occurrence.roomType.jwId))) {
      roomTypes.set(occurrence.roomType.jwId, occurrence);
    }
  }
  const selectedBuildings = [...buildings.values()].sort(
    (a, b) => a.building.jwId - b.building.jwId,
  );
  const campusOccurrences: CampusOccurrence[] = selectedBuildings.flatMap(
    ({ campus, semesterCode }) =>
      campus == null ? [] : [{ campus, semesterCode, source: "building" }],
  );
  return {
    rooms: [...rooms.values()]
      .map(({ room }) => room)
      .sort((a, b) => a.jwId - b.jwId),
    buildings: selectedBuildings.map(({ building }) => building),
    roomTypes: [...roomTypes.values()]
      .map(({ roomType }) => roomType)
      .sort((a, b) => a.jwId - b.jwId),
    campusOccurrences,
  };
}

function isNewer<T extends { semesterCode: number }>(
  incoming: T,
  existing: T | undefined,
): boolean {
  return (
    existing == null ||
    incoming.semesterCode > existing.semesterCode ||
    (incoming.semesterCode === existing.semesterCode &&
      JSON.stringify(incoming) > JSON.stringify(existing))
  );
}
