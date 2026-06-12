import * as z from "zod";
import { dateTimeSchema } from "./response-schema-primitives";

export const examRoomSchema = z.object({
  id: z.number().int(),
  room: z.string(),
  count: z.number().int(),
  examId: z.number().int(),
});

export const examBatchSchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
});

export const examSchema = z.object({
  id: z.number().int(),
  jwId: z.number().int(),
  examType: z.number().int().nullable(),
  startTime: z.number().int().nullable(),
  endTime: z.number().int().nullable(),
  examDate: dateTimeSchema.nullable(),
  examTakeCount: z.number().int().nullable(),
  examMode: z.string().nullable(),
  examBatchId: z.number().int().nullable(),
  sectionId: z.number().int(),
  examBatch: examBatchSchema.nullable(),
  examRooms: z.array(examRoomSchema),
});
