import * as z from "zod";
import {
  buildingSchema,
  campusSchema,
  localizedCourseBaseSchema,
  roomSchema,
  roomTypeSchema,
  scheduleBaseSchema,
  scheduleGroupSchema,
  sectionBaseSchema,
  semesterSchema,
  teacherSchema,
} from "./academic-response-schema-core";
import { createPaginatedSchema } from "./response-schema-primitives";

const localizedNameFields = {
  namePrimary: z.string(),
  nameSecondary: z.string().nullable(),
};

const localizedCampusSchema = campusSchema.extend(localizedNameFields);

const localizedBuildingWithCampusSchema = buildingSchema.extend({
  ...localizedNameFields,
  campus: localizedCampusSchema.nullable(),
});

const localizedRoomTypeSchema = roomTypeSchema.extend(localizedNameFields);

const localizedRoomWithBuildingCampusSchema = roomSchema.extend({
  ...localizedNameFields,
  building: localizedBuildingWithCampusSchema.nullable(),
  roomType: localizedRoomTypeSchema.nullable(),
});

const localizedTeacherWithDepartmentSchema = teacherSchema.extend({
  ...localizedNameFields,
  department: z
    .object({
      id: z.number().int(),
      code: z.string(),
      nameCn: z.string(),
      nameEn: z.string().nullable(),
      isCollege: z.boolean().nullable(),
      namePrimary: z.string(),
      nameSecondary: z.string().nullable(),
    })
    .nullable(),
});

export const scheduleEntrySchema = scheduleBaseSchema.extend({
  room: localizedRoomWithBuildingCampusSchema.nullable(),
  teachers: z.array(localizedTeacherWithDepartmentSchema),
  section: sectionBaseSchema.extend({
    course: localizedCourseBaseSchema,
    semester: semesterSchema.nullable(),
  }),
  scheduleGroup: scheduleGroupSchema,
});

export const paginatedScheduleResponseSchema =
  createPaginatedSchema(scheduleEntrySchema);

export const subscribedSchedulesResponseSchema = z.object({
  schedules: z.array(scheduleEntrySchema),
});
