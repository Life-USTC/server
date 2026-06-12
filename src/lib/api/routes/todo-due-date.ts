import { badRequest } from "@/lib/api/helpers";
import { parseDateInput } from "@/lib/time/parse-date-input";

export function parseTodoDueAt(dueAtRaw: unknown) {
  if (dueAtRaw === undefined) return { ok: true as const, dueAt: undefined };
  const dueAt = parseDateInput(dueAtRaw);
  if (dueAt === undefined) {
    return { ok: false as const, response: badRequest("Invalid due date") };
  }
  return { ok: true as const, dueAt };
}
