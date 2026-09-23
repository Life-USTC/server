/** Static-import upserts for campuses, buildings, rooms, and admin classes. */
import type { Prisma } from "../generated/prisma-node/client";
import { bulkUpsert, type ColumnValue } from "./database-writes";
import type {
  AdminClassBuild,
  BuildingBuild,
  CampusBuild,
  RoomBuild,
  RoomTypeBuild,
} from "./mappers";
import { requiredId } from "./required-id";

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
        build.campusJwId == null
          ? null
          : requiredId(
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
  ];
  const records = builds.map((build) => ({
    key: build.jwId,
    values: [
      build.nameCn,
      build.nameEn,
      build.code,
      build.floor,
      build.virtual,
      build.seatsForSection,
      build.remark,
      build.seats,
      build.buildingJwId == null
        ? null
        : requiredId(
            buildingMap,
            build.buildingJwId,
            `Building jwId ${build.buildingJwId} for Room jwId ${build.jwId}`,
          ),
      build.roomTypeJwId == null
        ? null
        : requiredId(
            roomTypeMap,
            build.roomTypeJwId,
            `RoomType jwId ${build.roomTypeJwId} for Room jwId ${build.jwId}`,
          ),
    ] satisfies ColumnValue[],
  }));
  return bulkUpsert(
    tx,
    "Room",
    "jwId",
    "int",
    columns,
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
  ];
  const records = builds.map((build) => ({
    key: build.jwId,
    values: [
      build.code,
      build.grade,
      build.nameCn,
      build.nameEn,
      build.stdCount,
      build.planCount,
      build.enabled,
      build.abbrZh,
      build.abbrEn,
    ] satisfies ColumnValue[],
  }));
  return bulkUpsert(
    tx,
    "AdminClass",
    "jwId",
    "int",
    columns,
    ["text", "text", "text", "text", "int", "int", "boolean", "text", "text"],
    records,
  );
}
