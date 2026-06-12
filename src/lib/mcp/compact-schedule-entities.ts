import { isRecord } from "@/lib/utils";
import { compactSection, compactTeacher } from "./compact-academic-entities";
import { compactCampus } from "./compact-base-entities";
import {
  asRecordArray,
  compactArrayRelations,
  compactRelations,
  pick,
} from "./compact-helpers";

export function compactSchedule(value: unknown) {
  if (!isRecord(value)) return value;
  const base = pick(value, [
    "id",
    "jwId",
    "date",
    "weekday",
    "startTime",
    "endTime",
    "weekIndex",
    "createdAt",
    "updatedAt",
    "customPlace",
  ]);

  if (Object.hasOwn(value, "room") && isRecord(value.room)) {
    const room = value.room;
    const roomOut: Record<string, unknown> = pick(room, [
      "id",
      "jwId",
      "namePrimary",
      "nameSecondary",
    ]);
    if (Object.hasOwn(room, "building") && isRecord(room.building)) {
      const bldg = room.building;
      const bldgOut: Record<string, unknown> = pick(bldg, [
        "id",
        "jwId",
        "namePrimary",
        "nameSecondary",
      ]);
      if (Object.hasOwn(bldg, "campus")) {
        bldgOut.campus = compactCampus(bldg.campus);
      }
      roomOut.building = bldgOut;
    }
    return {
      ...base,
      ...(Object.hasOwn(value, "section") && isRecord(value.section)
        ? { section: compactSection(value.section) }
        : {}),
      room: roomOut,
      ...compactArrayRelations(value, { teachers: compactTeacher }),
    };
  }

  return {
    ...base,
    ...compactRelations(value, { section: compactSection }),
    ...compactArrayRelations(value, { teachers: compactTeacher }),
  };
}

export function compactExam(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...pick(value, [
      "id",
      "jwId",
      "examDate",
      "startTime",
      "endTime",
      "createdAt",
      "updatedAt",
      "examType",
      "examMode",
      "examTakeCount",
    ]),
    ...compactRelations(value, {
      section: compactSection,
      examBatch: (v) =>
        isRecord(v)
          ? pick(v, ["id", "jwId", "namePrimary", "nameSecondary"])
          : v,
    }),
    ...(Object.hasOwn(value, "examRooms") && Array.isArray(value.examRooms)
      ? {
          examRooms: asRecordArray(value.examRooms).map((room) =>
            pick(room, [
              "id",
              "jwId",
              "roomName",
              "buildingName",
              "room",
              "count",
            ]),
          ),
        }
      : {}),
  };
}
