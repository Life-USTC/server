/** Static-import upserts for campuses, buildings, rooms, and admin classes. */
import type { Prisma } from "../generated/prisma-node/client";
import { bulkUpsert } from "./database-writes";
import type {
  AdminClassBuild,
  BuildingBuild,
  CampusBuild,
  RoomBuild,
  RoomTypeBuild,
} from "./mappers";
import { optionalId } from "./required-id";

export async function upsertCampuses(
  tx: Prisma.TransactionClient,
  builds: CampusBuild[],
): Promise<Map<number, number>> {
  return bulkUpsert(
    tx,
    "Campus",
    "jwId",
    "int",
    ["nameCn", "nameEn", "code"],
    ["text", "text", "text"],
    builds.map((build) => ({
      key: build.jwId,
      values: [build.nameCn, build.nameEn, build.code],
    })),
  );
}

export async function upsertRoomTypes(
  tx: Prisma.TransactionClient,
  builds: RoomTypeBuild[],
): Promise<Map<number, number>> {
  return bulkUpsert(
    tx,
    "RoomType",
    "jwId",
    "int",
    ["nameCn", "nameEn", "code"],
    ["text", "text", "text"],
    builds.map((build) => ({
      key: build.jwId,
      values: [build.nameCn, build.nameEn, build.code],
    })),
  );
}

export async function upsertBuildings(
  tx: Prisma.TransactionClient,
  builds: BuildingBuild[],
  campusMap: Map<number, number>,
): Promise<Map<number, number>> {
  return bulkUpsert(
    tx,
    "Building",
    "jwId",
    "int",
    ["nameCn", "nameEn", "code", "campusId"],
    ["text", "text", "text", "int"],
    builds.map((build) => ({
      key: build.jwId,
      values: [
        build.nameCn,
        build.nameEn,
        build.code,
        optionalId(
          campusMap,
          build.campusJwId,
          `Campus jwId ${build.campusJwId} for Building jwId ${build.jwId}`,
        ),
      ],
    })),
  );
}

export async function upsertRooms(
  tx: Prisma.TransactionClient,
  builds: RoomBuild[],
  buildingMap: Map<number, number>,
  roomTypeMap: Map<number, number>,
): Promise<Map<number, number>> {
  const columns = [
    "nameCn",
    "nameEn",
    "code",
    "floor",
    "virtual",
    "seatsForSection",
    "remark",
    "seats",
    "buildingId",
    "roomTypeId",
  ] as const;
  const records = builds.map((build) => {
    const values = {
      ...build,
      buildingId: optionalId(
        buildingMap,
        build.buildingJwId,
        `Building jwId ${build.buildingJwId} for Room jwId ${build.jwId}`,
      ),
      roomTypeId: optionalId(
        roomTypeMap,
        build.roomTypeJwId,
        `RoomType jwId ${build.roomTypeJwId} for Room jwId ${build.jwId}`,
      ),
    };
    return { key: build.jwId, values: columns.map((column) => values[column]) };
  });
  return bulkUpsert(
    tx,
    "Room",
    "jwId",
    "int",
    [...columns],
    [
      "text",
      "text",
      "text",
      "int",
      "boolean",
      "int",
      "text",
      "int",
      "int",
      "int",
    ],
    records,
  );
}

export async function upsertAdminClasses(
  tx: Prisma.TransactionClient,
  builds: AdminClassBuild[],
): Promise<Map<number, number>> {
  const columns = [
    "code",
    "grade",
    "nameCn",
    "nameEn",
    "stdCount",
    "planCount",
    "enabled",
    "abbrZh",
    "abbrEn",
  ] as const;
  const records = builds.map((build) => ({
    key: build.jwId,
    values: columns.map((column) => build[column]),
  }));
  return bulkUpsert(
    tx,
    "AdminClass",
    "jwId",
    "int",
    [...columns],
    ["text", "text", "text", "text", "int", "int", "boolean", "text", "text"],
    records,
  );
}
