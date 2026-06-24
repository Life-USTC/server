import * as z from "zod";
import { todoPrioritySchema } from "@/features/todos/lib/todo-schema";
import {
  busCampusSchema,
  sectionCompactSchema,
} from "./academic-response-schema-core";
import { dateTimeSchema } from "./response-schema-primitives";

export const viewerContextSchema = z.object({
  userId: z.string().nullable(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  isAdmin: z.boolean(),
  isAuthenticated: z.boolean(),
  isSuspended: z.boolean(),
  suspensionReason: z.string().nullable(),
  suspensionExpiresAt: dateTimeSchema.nullable(),
});

export const calendarSubscriptionSchema = z.object({
  userId: z.string(),
  sections: z.array(sectionCompactSchema),
  calendarPath: z.string(),
  calendarUrl: z.string(),
  note: z.string(),
});

export const currentCalendarSubscriptionResponseSchema = z.object({
  subscription: calendarSubscriptionSchema.nullable(),
});

export const calendarSubscriptionCreateResponseSchema = z.object({
  subscription: calendarSubscriptionSchema.nullable(),
});

export const calendarSubscriptionAppendResponseSchema =
  calendarSubscriptionCreateResponseSchema.extend({
    addedCount: z.number().int().nonnegative(),
    alreadySubscribedCount: z.number().int().nonnegative(),
  });

export const calendarSubscriptionImportResponseSchema = z.object({
  success: z.boolean(),
  semester: z.object({
    id: z.number().int(),
    nameCn: z.string().nullable(),
    code: z.string().nullable(),
  }),
  matchedCodes: z.array(z.string()),
  unmatchedCodes: z.array(z.string()),
  ambiguousCodes: z.array(z.string()),
  sections: z.array(sectionCompactSchema),
  addedCount: z.number().int().nonnegative(),
  addedSections: z.array(sectionCompactSchema),
  alreadySubscribedCount: z.number().int().nonnegative(),
  alreadySubscribedSections: z.array(sectionCompactSchema),
  subscription: calendarSubscriptionSchema.nullable(),
});

export const matchSectionCodesResponseSchema = z.object({
  semester: z.object({
    id: z.number().int(),
    nameCn: z.string().nullable(),
    code: z.string().nullable(),
  }),
  matchedCodes: z.array(z.string()),
  unmatchedCodes: z.array(z.string()),
  suggestions: z.record(z.string(), z.array(z.string())),
  sections: z.array(sectionCompactSchema),
  total: z.number().int().nonnegative(),
});

export const dashboardLinkPinResponseSchema = z.object({
  pinnedSlugs: z.array(z.string()),
  maxPinnedLinks: z.number().int().positive(),
  error: z.string().nullable(),
});

export const openApiDocumentResponseSchema = z.object({
  openapi: z.string(),
  info: z.object({
    title: z.string(),
    version: z.string(),
    description: z.string().optional(),
  }),
  servers: z
    .array(
      z.object({
        url: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional(),
  paths: z.record(z.string(), z.unknown()),
});

export const readinessResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  uptimeSeconds: z.number().nonnegative(),
  checks: z.object({
    database: z.object({
      status: z.enum(["ok", "error"]),
      durationMs: z.number().nonnegative(),
    }),
    storage: z.object({
      status: z.string(),
      binding: z.string(),
      reason: z.string().optional(),
    }),
  }),
});

export const meResponseSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  username: z.string().nullable(),
  isAdmin: z.boolean(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const todoItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string().nullable(),
  priority: todoPrioritySchema,
  completed: z.boolean(),
  dueAt: dateTimeSchema.nullable(),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const todoCountsSchema = z.object({
  incomplete: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  overdue: z.number().int().nonnegative(),
});

export const todosListResponseSchema = z.object({
  counts: todoCountsSchema,
  todos: z.array(todoItemSchema),
});

export const todoUpdateResponseSchema = z.object({
  success: z.boolean(),
  todo: todoItemSchema,
});

export const openApiErrorSchema = z.object({
  error: z.string(),
});

export const successResponseSchema = z.object({
  success: z.boolean(),
});

export const idResponseSchema = z.object({
  id: z.string(),
});

export { busCampusSchema };
