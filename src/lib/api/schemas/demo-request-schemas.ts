import * as z from "zod";

export const demoTodoCreateRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
});
