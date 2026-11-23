import { describe, expect, it, vi } from "vitest";
import { paginatedQuery } from "@/lib/query-pagination";

describe("short first page totals", () => {
  it.each([
    { page: 1, data: [], countCalls: 0, total: 0 },
    { page: 1, data: [1], countCalls: 0, total: 1 },
    { page: 1, data: [1, 2], countCalls: 1, total: 3 },
    { page: 2, data: [3], countCalls: 1, total: 3 },
    { page: 3, data: [], countCalls: 1, total: 3 },
  ])("page $page with $data", async ({ page, data, countCalls, total }) => {
    const count = vi.fn(async () => 3);
    const list = vi.fn(async () => data);
    const result = await paginatedQuery(list, count, page, 2, {
      inferShortFirstPageTotal: true,
    });
    expect(list).toHaveBeenCalledWith((page - 1) * 2, 2);
    expect(count).toHaveBeenCalledTimes(countCalls);
    expect(result.data).toEqual(data);
    expect(result.pagination.total).toBe(total);
  });
});
