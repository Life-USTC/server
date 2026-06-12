import { pick } from "@/lib/mcp/compact-payload";
import { isRecord } from "@/lib/utils";
import { summarizeSectionCard } from "./event-summary-academic-cards";

export function summarizeTodoCard(value: unknown) {
  if (!isRecord(value)) return value;
  return pick(value, [
    "id",
    "title",
    "priority",
    "dueAt",
    "completed",
    "createdAt",
    "updatedAt",
  ]);
}

export function summarizeHomeworkCard(value: unknown) {
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = pick(value, [
    "id",
    "sectionId",
    "title",
    "isMajor",
    "requiresTeam",
    "publishedAt",
    "submissionStartAt",
    "submissionDueAt",
    "completion",
    "commentCount",
  ]);
  if (Object.hasOwn(value, "section")) {
    out.section = summarizeSectionCard(value.section);
  }
  return out;
}
