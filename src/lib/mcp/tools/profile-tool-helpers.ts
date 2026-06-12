import * as z from "zod";
import type { Prisma } from "@/generated/prisma/client";
import {
  mcpModeInputSchema,
  todoPrioritySchema,
} from "@/lib/mcp/tools/_helpers";

export const userProfileSelect = {
  id: true,
  username: true,
  name: true,
  image: true,
  isAdmin: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const todoSnapshotSelect = {
  id: true,
  title: true,
  content: true,
  priority: true,
  dueAt: true,
  completed: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const getMyProfileInputSchema = {
  mode: mcpModeInputSchema,
};

export const listMyTodosInputSchema = {
  includeCompleted: z.boolean().default(false),
  limit: z.number().int().min(1).max(200).default(50),
  mode: mcpModeInputSchema,
};

export const createMyTodoInputSchema = {
  title: z.string().trim().min(1).max(200),
  content: z.string().max(4000).optional().nullable(),
  priority: todoPrioritySchema.default("medium"),
  dueAt: z.union([z.string(), z.null()]).optional(),
  mode: mcpModeInputSchema,
};

export const updateMyTodoInputSchema = {
  id: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(4000).optional().nullable(),
  priority: todoPrioritySchema.optional(),
  dueAt: z.union([z.string(), z.null()]).optional(),
  completed: z.boolean().optional(),
  mode: mcpModeInputSchema,
};

export const deleteMyTodoInputSchema = {
  id: z.string().trim().min(1),
  mode: mcpModeInputSchema,
};

export function buildTodoUpdateInput(input: {
  completed?: boolean;
  content?: string | null;
  dueAt: Date | null | undefined;
  hasDueAt: boolean;
  priority?: "low" | "medium" | "high";
  title?: string;
}) {
  const updates: Prisma.TodoUpdateInput = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.content !== undefined) {
    updates.content = input.content?.trim() || null;
  }
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.hasDueAt) updates.dueAt = input.dueAt;
  if (input.completed !== undefined) updates.completed = input.completed;
  return updates;
}
