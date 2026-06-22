import type * as z from "zod";
import { readApiErrorMessage } from "@/lib/api/client";
import { homeworkCompletionResponseSchema } from "@/lib/api/schemas/homeworks-response-schemas";

export type HomeworkCompletionResult = z.infer<
  typeof homeworkCompletionResponseSchema
>;

type HomeworkCompletionState = {
  completion?: unknown | null;
};

export function applyHomeworkCompletionResult<
  Homework extends HomeworkCompletionState,
>(homework: Homework, result: HomeworkCompletionResult): Homework {
  return {
    ...homework,
    completion: result.completed
      ? { completedAt: result.completedAt ?? new Date().toISOString() }
      : null,
  } as Homework;
}

async function readCompletionPayload(
  response: Response,
  fallbackMessage: string,
) {
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(fallbackMessage);
  }

  const parsed = homeworkCompletionResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(fallbackMessage);
  }

  return parsed.data;
}

export async function updateHomeworkCompletion(input: {
  completed: boolean;
  fallbackMessage: string;
  homeworkId: number | string;
}): Promise<HomeworkCompletionResult> {
  const response = await fetch(
    `/api/homeworks/${input.homeworkId}/completion`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completed: input.completed }),
    },
  );

  return readCompletionPayload(response, input.fallbackMessage);
}
