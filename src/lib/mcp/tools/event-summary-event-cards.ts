import { pick } from "@/lib/mcp/compact-payload";
import { isRecord } from "@/lib/utils";
import {
  summarizeRoomCard,
  summarizeSectionCard,
  summarizeTeacherCard,
} from "./event-summary-academic-cards";

export function summarizeScheduleCard(value: unknown) {
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = pick(value, [
    "id",
    "date",
    "weekday",
    "startTime",
    "endTime",
    "weekIndex",
    "customPlace",
  ]);
  if (Object.hasOwn(value, "section")) {
    out.section = summarizeSectionCard(value.section);
  }
  if (Object.hasOwn(value, "room")) {
    out.room = summarizeRoomCard(value.room);
  }
  if (Array.isArray(value.teachers)) {
    out.teachers = value.teachers.map(summarizeTeacherCard);
  }
  return out;
}

export function summarizeExamCard(value: unknown) {
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = pick(value, [
    "id",
    "jwId",
    "examDate",
    "startTime",
    "endTime",
    "examType",
    "examMode",
    "examTakeCount",
  ]);
  if (Object.hasOwn(value, "section")) {
    out.section = summarizeSectionCard(value.section);
  }
  if (Array.isArray(value.examRooms)) {
    out.examRooms = value.examRooms.map((room) =>
      isRecord(room)
        ? pick(room, ["id", "jwId", "roomName", "buildingName", "count"])
        : room,
    );
  }
  return out;
}
