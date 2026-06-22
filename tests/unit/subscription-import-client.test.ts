import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendSubscribedSectionIds,
  extractSubscriptionSectionCodes,
  fetchCurrentSubscribedSectionIds,
  matchSubscriptionSectionCodes,
  updateSubscribedSectionIds,
} from "@/features/home/lib/subscription-import-client";

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

function compactSection(id: number) {
  return {
    id,
    jwId: 1000 + id,
    code: `MATH.${String(id).padStart(2, "0")}`,
    bizTypeId: null,
    credits: null,
    period: null,
    periodsPerWeek: null,
    timesPerWeek: null,
    stdCount: null,
    limitCount: null,
    graduateAndPostgraduate: null,
    dateTimePlaceText: null,
    dateTimePlacePersonText: null,
    actualPeriods: null,
    theoryPeriods: null,
    practicePeriods: null,
    experimentPeriods: null,
    machinePeriods: null,
    designPeriods: null,
    testPeriods: null,
    scheduleState: null,
    suggestScheduleWeeks: null,
    suggestScheduleWeekInfo: null,
    scheduleJsonParams: null,
    selectedStdCount: null,
    remark: null,
    scheduleRemark: null,
    courseId: id,
    semesterId: 1,
    campusId: 1,
    examModeId: null,
    openDepartmentId: null,
    teachLanguageId: null,
    roomTypeId: null,
    course: {
      id,
      jwId: 2000 + id,
      code: `COURSE-${id}`,
      nameCn: `课程 ${id}`,
      nameEn: null,
      namePrimary: `Course ${id}`,
      nameSecondary: null,
      categoryId: null,
      classTypeId: null,
      classifyId: null,
      educationLevelId: null,
      gradationId: null,
      typeId: null,
      category: null,
      classType: null,
      classify: null,
      educationLevel: null,
      gradation: null,
      type: null,
    },
    semester: {
      id: 1,
      jwId: 3001,
      nameCn: "2026 春",
      code: "2026SP",
      startDate: null,
      endDate: null,
    },
    campus: {
      id: 1,
      jwId: null,
      nameCn: "东校区",
      nameEn: null,
      namePrimary: "东校区",
      nameSecondary: null,
      code: "east",
    },
    openDepartment: null,
    teachers: [],
  };
}

function matchPayload() {
  return {
    semester: {
      id: 1,
      nameCn: "2026 春",
      code: "2026SP",
    },
    matchedCodes: ["MATH.01"],
    unmatchedCodes: ["MATH.02"],
    suggestions: {},
    sections: [compactSection(1)],
    total: 1,
  };
}

function subscriptionPayload(sectionIds: number[]) {
  return {
    subscription: {
      userId: "user-1",
      sections: sectionIds.map(compactSection),
      calendarPath: "/calendar/user-1.ics",
      calendarUrl: "https://example.test/calendar/user-1.ics",
      note: "private",
    },
  };
}

describe("subscription import client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts and deduplicates section codes", () => {
    expect(
      extractSubscriptionSectionCodes("MATH.01 and CS_A-2.03 MATH.01 bad"),
    ).toEqual(["MATH.01", "CS_A-2.03"]);
  });

  it("posts match-code requests and validates successful payloads", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(matchPayload()));
    vi.stubGlobal("fetch", fetchMock);

    const result = await matchSubscriptionSectionCodes({
      codes: ["MATH.01"],
      fetchFailedMessage: "fetch failed",
      semesterId: 1,
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/sections/match-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codes: ["MATH.01"], semesterId: 1 }),
    });
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].course).toMatchObject({
      namePrimary: "Course 1",
    });
  });

  it("uses API error payloads before fallback messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: "  invalid semester  " }, { status: 400 }),
      ),
    );

    await expect(
      matchSubscriptionSectionCodes({
        codes: ["MATH.01"],
        fetchFailedMessage: "fetch failed",
      }),
    ).rejects.toThrow("invalid semester");
  });

  it("falls back when error payloads are not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("plain failure", { status: 500 })),
    );

    await expect(
      fetchCurrentSubscribedSectionIds("fetch failed"),
    ).rejects.toThrow("fetch failed");
  });

  it("rejects malformed successful payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ sections: [] })),
    );

    await expect(
      matchSubscriptionSectionCodes({
        codes: ["MATH.01"],
        fetchFailedMessage: "fetch failed",
      }),
    ).rejects.toThrow("fetch failed");
  });

  it("extracts current subscription section ids", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(subscriptionPayload([1, 2]))),
    );

    await expect(
      fetchCurrentSubscribedSectionIds("fetch failed"),
    ).resolves.toEqual([1, 2]);
  });

  it("replaces subscription section ids with a validated request", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(subscriptionPayload([3])));
    vi.stubGlobal("fetch", fetchMock);

    await updateSubscribedSectionIds([3], "import failed");

    expect(fetchMock).toHaveBeenCalledWith("/api/calendar-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionIds: [3] }),
    });
  });

  it("appends selected section ids without duplicating existing ids", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(subscriptionPayload([1, 2])))
      .mockResolvedValueOnce(jsonResponse(subscriptionPayload([1, 2, 3])));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      appendSubscribedSectionIds({
        fetchFailedMessage: "fetch failed",
        importFailedMessage: "import failed",
        selectedSectionIds: [2, 3],
      }),
    ).resolves.toBe(2);

    expect(fetchMock).toHaveBeenLastCalledWith("/api/calendar-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionIds: [1, 2, 3] }),
    });
  });
});
