import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendSubscribedSectionIds,
  extractSubscriptionSectionCodes,
  matchSubscriptionSectionCodes,
  removeSubscribedSectionIds,
} from "@/features/subscriptions/lib/subscription-import-client";

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

function firstFetchCall(fetchMock: ReturnType<typeof vi.fn>) {
  const call = fetchMock.mock.calls[0];
  expect(call).toBeDefined();
  return call as unknown as [string, RequestInit & { body: string }];
}

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

function appendPayload(sectionIds: number[], addedCount = sectionIds.length) {
  return {
    ...subscriptionPayload(sectionIds),
    addedCount,
    alreadySubscribedCount: sectionIds.length - addedCount,
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

    const [path, init] = firstFetchCall(fetchMock);
    expect(path).toBe("/api/sections/match-codes");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      codes: ["MATH.01"],
      semesterId: 1,
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
      removeSubscribedSectionIds({
        errorMessage: "remove failed",
        sectionIds: [1],
      }),
    ).rejects.toThrow("remove failed");
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

  it("removes subscription section ids with a validated request", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(subscriptionPayload([3])));
    vi.stubGlobal("fetch", fetchMock);

    await removeSubscribedSectionIds({
      errorMessage: "remove failed",
      sectionIds: [3],
    });

    const [path, init] = firstFetchCall(fetchMock);
    expect(path).toBe("/api/calendar-subscriptions");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({ sectionIds: [3] });
  });

  it("does not call the remove route when no section ids are selected", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await removeSubscribedSectionIds({
      errorMessage: "remove failed",
      sectionIds: [],
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("appends selected section ids through the server-owned append route", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(appendPayload([1, 2, 3], 2)),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      appendSubscribedSectionIds({
        importFailedMessage: "import failed",
        selectedSectionIds: [2, 3],
      }),
    ).resolves.toBe(2);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [path, init] = firstFetchCall(fetchMock);
    expect(path).toBe("/api/calendar-subscriptions");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ sectionIds: [2, 3] });
  });

  it("does not call the append route when no section ids are selected", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      appendSubscribedSectionIds({
        importFailedMessage: "import failed",
        selectedSectionIds: [],
      }),
    ).resolves.toBe(0);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
