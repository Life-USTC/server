import * as z from "zod";
import {
  todoContentSchema,
  todoDueAtInputSchema,
  todoPrioritySchema,
  todoTitleSchema,
} from "@/features/todos/lib/todo-schema";
import { mcpModeInputSchema } from "@/lib/mcp/tools/_helpers";

export const getMyProfileInputSchema = {
  mode: mcpModeInputSchema,
};

export const getPublicUserProfileInputSchema = {
  username: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
  mode: mcpModeInputSchema,
};

export const listMyTodosInputSchema = {
  includeCompleted: z.boolean().default(false),
  limit: z.number().int().min(1).max(200).default(50),
  mode: mcpModeInputSchema,
};

export const createMyTodoInputSchema = {
  title: todoTitleSchema,
  content: todoContentSchema,
  priority: todoPrioritySchema.default("medium"),
  dueAt: todoDueAtInputSchema,
  mode: mcpModeInputSchema,
};

export const updateMyTodoInputSchema = {
  id: z.string().trim().min(1),
  title: todoTitleSchema.optional(),
  content: todoContentSchema,
  priority: todoPrioritySchema.optional(),
  dueAt: todoDueAtInputSchema,
  completed: z.boolean().optional(),
  mode: mcpModeInputSchema,
};

export const deleteMyTodoInputSchema = {
  id: z.string().trim().min(1),
  mode: mcpModeInputSchema,
};
