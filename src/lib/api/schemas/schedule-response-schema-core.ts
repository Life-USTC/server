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
} from "./academic-response-schema-core";
import {
  departmentSchema,
  teacherTitleSchema,
} from "./academic-teacher-response-schemas";
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

const localizedDepartmentSchema = departmentSchema.extend(localizedNameFields);

const localizedTeacherTitleSchema =
  teacherTitleSchema.extend(localizedNameFields);

const scheduleTeacherSchema = z.object({
  id: z.number().int(),
  personId: z.number().int().nullable(),
  teacherId: z.number().int().nullable(),
  code: z.string().nullable(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  namePrimary: z.string(),
  nameSecondary: z.string().nullable(),
  department: localizedDepartmentSchema.nullable(),
  teacherTitle: localizedTeacherTitleSchema.nullable().optional(),
  _count: z
    .object({
      sections: z.number().int(),
    })
    .optional(),
});

export const scheduleEntrySchema = scheduleBaseSchema.extend({
  room: localizedRoomWithBuildingCampusSchema.nullable(),
  teachers: z.array(scheduleTeacherSchema),
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
