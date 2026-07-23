import * as z from "zod";

const demoTodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  priority: z.enum(["medium", "high"]),
});

export const demoTokenResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
  tokenType: z.literal("Bearer"),
});

export const demoTodosResponseSchema = z.object({
  fixture: z.literal(true),
  todos: z.array(demoTodoSchema),
});

export const demoTodoCreateResponseSchema = z.object({
  simulated: z.literal(true),
  todo: demoTodoSchema,
});
