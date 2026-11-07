import { apiFetch } from "@/lib/api/client";
import { paginatedSectionSchedulesResponseSchema } from "@/lib/api/schemas/schedule-response-schema-core";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import { nextHomeworkClassStarts } from "./homework-due-shortcuts";

/** Read only the selected section. Pagination precedes neither the actual-time
 * filter nor deduplication: a page of past/duplicate rows cannot hide a later class.
 */
export async function fetchHomeworkClassStarts(input: {
  sectionJwId: number;
  locale: string;
  signal: AbortSignal;
  now?: Date;
}): Promise<string[]> {
  const now = input.now ?? new Date();
  let starts: string[] = [];
  let page = 1;
  for (;;) {
    input.signal.throwIfAborted();
    const query = new URLSearchParams({
      locale: input.locale,
      dateFrom: formatShanghaiDate(now),
      page: String(page),
      pageSize: "100",
    });
    const response = await apiFetch(
      `/api/catalog/sections/${input.sectionJwId}/schedules?${query}`,
      { signal: input.signal },
    );
    if (!response.ok) throw new Error("Failed to read class deadlines");
    const result = paginatedSectionSchedulesResponseSchema.parse(
      await response.json(),
    );
    input.signal.throwIfAborted();
    starts = nextHomeworkClassStarts(
      [
        ...starts.map((date) => ({
          date,
          startTime: Number(date.slice(11, 16).replace(":", "")),
        })),
        ...result.data,
      ],
      now,
    );
    if (starts.length >= 3 || page >= result.pagination.totalPages)
      return starts;
    page += 1;
  }
}
