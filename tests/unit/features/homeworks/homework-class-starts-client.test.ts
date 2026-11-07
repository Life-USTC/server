import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiFetch: apiFetchMock }));

import { fetchHomeworkClassStarts } from "@/features/homeworks/lib/homework-class-starts-client";

function row(
  id: number,
  startTime: string,
  date = "2026-11-07T00:00:00+08:00",
) {
  return {
    id,
    periods: 2,
    date,
    weekday: 6,
    startTime,
    endTime: "23:59",
    experiment: null,
    customPlace: null,
    lessonType: null,
    weekIndex: 1,
    exerciseClass: null,
    startUnit: 1,
    endUnit: 2,
    roomId: null,
    sectionId: 7,
    scheduleGroupId: 1,
    room: null,
    teachers: [],
    teacherParticipations: [],
    scheduleGroup: {
      id: 1,
      jwId: 1,
      no: 1,
      limitCount: 30,
      stdCount: 1,
      actualPeriods: 2,
      isDefault: true,
      sectionId: 7,
    },
  };
}
function response(
  data: ReturnType<typeof row>[],
  page: number,
  totalPages: number,
) {
  return Response.json({
    data,
    pagination: { page, pageSize: 100, total: totalPages * 100, totalPages },
  });
}
const input = () => ({
  sectionJwId: 7007,
  locale: "en-us",
  signal: new AbortController().signal,
  now: new Date("2026-11-07T04:00:00Z"),
});
describe("fresh class deadlines", () => {
  beforeEach(() => vi.clearAllMocks());
  it("continues beyond a page of past rows and a page of duplicates before choosing three actual starts", async () => {
    apiFetchMock.mockResolvedValueOnce(
      response(
        Array.from({ length: 100 }, (_, i) => row(i, "08:00")),
        1,
        4,
      ),
    );
    apiFetchMock.mockResolvedValueOnce(
      response(
        Array.from({ length: 100 }, (_, i) => row(100 + i, "13:00")),
        2,
        4,
      ),
    );
    apiFetchMock.mockResolvedValueOnce(
      response([row(201, "13:00"), row(202, "14:00"), row(203, "15:00")], 3, 4),
    );
    expect(await fetchHomeworkClassStarts(input())).toEqual([
      "2026-11-07T13:00:00+08:00",
      "2026-11-07T14:00:00+08:00",
      "2026-11-07T15:00:00+08:00",
    ]);
    expect(apiFetchMock).toHaveBeenCalledTimes(3);
    const urls = apiFetchMock.mock.calls.map(
      ([url]) => new URL(String(url), "https://example.test"),
    );
    expect(urls.map((url) => url.searchParams.get("page"))).toEqual([
      "1",
      "2",
      "3",
    ]);
    for (const url of urls) {
      expect(url.pathname).toBe("/api/catalog/sections/7007/schedules");
      expect(url.searchParams.get("pageSize")).toBe("100");
      expect(url.searchParams.get("dateFrom")).toBe("2026-11-07");
    }
  });
  it("stops at the declared final page when fewer than three future starts exist", async () => {
    apiFetchMock.mockResolvedValueOnce(
      response([row(1, "13:00"), row(2, "13:00")], 1, 1),
    );
    expect(await fetchHomeworkClassStarts(input())).toEqual([
      "2026-11-07T13:00:00+08:00",
    ]);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
  it("fails explicitly rather than returning a partial stale list on HTTP or schema failure", async () => {
    apiFetchMock.mockResolvedValueOnce(
      new Response("Unavailable", { status: 503 }),
    );
    await expect(fetchHomeworkClassStarts(input())).rejects.toThrow();
    apiFetchMock.mockResolvedValueOnce(
      Response.json({ data: [], pagination: {} }),
    );
    await expect(fetchHomeworkClassStarts(input())).rejects.toThrow();
  });
  it("does not return a response after its owner was cancelled", async () => {
    const abort = new AbortController();
    apiFetchMock.mockImplementationOnce(async () => {
      abort.abort();
      return response([row(1, "13:00")], 1, 1);
    });
    await expect(
      fetchHomeworkClassStarts({ ...input(), signal: abort.signal }),
    ).rejects.toThrow();
  });
});
