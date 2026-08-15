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
import { sectionPublicContextSchema } from "./academic-section-list-response-schemas";
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

export const scheduleTeacherSchema = z.strictObject({
  id: z.number().int(),
  jwId: z.number().int(),
  personId: z.number().int().nullable(),
  code: z.string().nullable(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  namePrimary: z.string(),
  nameSecondary: z.string().nullable(),
  department: localizedDepartmentSchema.nullable(),
});

export const workspaceScheduleTeacherSchema = scheduleTeacherSchema.extend({
  teacherTitle: teacherTitleSchema.nullable(),
  _count: z.strictObject({ sections: z.number().int() }),
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

export const sectionScheduleWithContextSchema =
  sectionScheduleEntrySchema.extend({
    section: sectionPublicContextSchema,
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

export const subscribedScheduleEntrySchema = scheduleEntrySchema.extend({
  teachers: z.array(workspaceScheduleTeacherSchema),
});

export const subscribedSchedulesResponseSchema = z.strictObject({
  schedules: z.array(subscribedScheduleEntrySchema),
});

export type ScheduleEntryDto = z.output<typeof scheduleEntrySchema>;
export type SectionScheduleEntryDto = z.output<
  typeof sectionScheduleEntrySchema
>;
export type SectionScheduleWithContextDto = z.output<
  typeof sectionScheduleWithContextSchema
>;
