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
  departmentSummarySchema,
  teacherTitleSchema,
} from "./academic-teacher-response-schemas";
import { createPaginatedSchema } from "./response-schema-primitives";

const localizedNameFields = {
  namePrimary: z.string(),
  nameSecondary: z.string().nullable(),
};

const localizedCampusSchema = campusSchema.extend(localizedNameFields);

export const scheduleBuildingSchema = buildingSchema.extend({
  ...localizedNameFields,
  campus: localizedCampusSchema.nullable(),
});

const localizedRoomTypeSchema = roomTypeSchema.extend(localizedNameFields);

export const scheduleRoomSchema = roomSchema.extend({
  ...localizedNameFields,
  building: scheduleBuildingSchema.nullable(),
  roomType: localizedRoomTypeSchema.nullable(),
});

const localizedDepartmentSchema = departmentSummarySchema;

const localizedTeacherTitleSchema =
  teacherTitleSchema.extend(localizedNameFields);

export const scheduleTeacherSchema = z.object({
  id: z.number().int(),
  jwId: z.number().int(),
  personId: z.number().int().nullable(),
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
  room: scheduleRoomSchema.nullable(),
  teachers: z.array(scheduleTeacherSchema),
  section: sectionBaseSchema.extend({
    course: localizedCourseBaseSchema,
    semester: semesterSchema.nullable(),
  }),
  scheduleGroup: scheduleGroupSchema,
});

export const sectionScheduleEntrySchema = scheduleBaseSchema.extend({
  room: scheduleRoomSchema.nullable(),
  teachers: z.array(scheduleTeacherSchema),
  scheduleGroup: scheduleGroupSchema,
});

export const sectionSchedulesResponseSchema = z.array(
  sectionScheduleEntrySchema,
);

export const scheduleGroupWithSchedulesSchema = scheduleGroupSchema.extend({
  schedules: z.array(scheduleBaseSchema),
});

export const scheduleGroupsResponseSchema = z.array(
  scheduleGroupWithSchedulesSchema,
);

export const paginatedScheduleResponseSchema =
  createPaginatedSchema(scheduleEntrySchema);

export const subscribedSchedulesResponseSchema = z.object({
  schedules: z.array(scheduleEntrySchema),
});

export type ScheduleEntryDto = z.output<typeof scheduleEntrySchema>;
