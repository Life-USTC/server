import { afterEach, describe, expect, it, vi } from "vitest";

const {
  examCountMock,
  examFindManyMock,
  scheduleCountMock,
  scheduleFindManyMock,
  userSectionSubscriptionFindManyMock,
} = vi.hoisted(() => ({
  examCountMock: vi.fn(),
  examFindManyMock: vi.fn(),
  scheduleCountMock: vi.fn(),
  scheduleFindManyMock: vi.fn(),
  userSectionSubscriptionFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(() => ({
    exam: { count: examCountMock, findMany: examFindManyMock },
    schedule: { count: scheduleCountMock, findMany: scheduleFindManyMock },
  })),
  prisma: {
    userSectionSubscription: {
      findMany: userSectionSubscriptionFindManyMock,
    },
  },
  withUserDbContext: vi.fn(
    async (
      _userId: string,
      action: (tx: {
        userSectionSubscription: {
          findMany: typeof userSectionSubscriptionFindManyMock;
        };
      }) => Promise<unknown>,
    ) =>
      action({
        userSectionSubscription: {
          findMany: userSectionSubscriptionFindManyMock,
        },
      }),
  ),
}));

/**
 * Compact calendar and schedule DTO consumers omit these lookup relations.
 * Full calendar, MCP exam and paginated GraphQL readers still publish them.
 */
const CATALOG_LOOKUP_RELATIONS = ["examMode", "teachLanguage"] as const;
const COURSE_LOOKUP_RELATIONS = [
  "category",
  "classify",
  "classType",
  "educationLevel",
  "gradation",
  "type",
] as const;

function sectionIncludeOf(call: { include?: Record<string, unknown> }) {
  const section = call.include?.section as
    | { include?: Record<string, unknown> }
    | undefined;
  if (!section?.include) throw new Error("expected a section include");
  return section.include;
}

function expectNarrowSectionInclude(sectionInclude: Record<string, unknown>) {
  expect(sectionInclude).toMatchObject({
    course: true,
    semester: true,
    campus: true,
    openDepartment: true,
  });
  for (const relation of CATALOG_LOOKUP_RELATIONS) {
    expect(sectionInclude).not.toHaveProperty(relation);
  }
  expect(sectionInclude.course).toBe(true);
}

function expectCatalogSectionInclude(sectionInclude: Record<string, unknown>) {
  for (const relation of CATALOG_LOOKUP_RELATIONS) {
    expect(sectionInclude).toHaveProperty(relation, true);
  }
  const course = sectionInclude.course as { include?: Record<string, unknown> };
  for (const relation of COURSE_LOOKUP_RELATIONS) {
    expect(course.include).toHaveProperty(relation, true);
  }
}

describe("schedule.viewer-scoped-section-projection", () => {
  afterEach(() => {
    examCountMock.mockReset();
    examFindManyMock.mockReset();
    scheduleCountMock.mockReset();
    scheduleFindManyMock.mockReset();
    userSectionSubscriptionFindManyMock.mockReset();
    vi.resetModules();
  });

  it("loads only the published section context for DTO schedule reads", async () => {
    userSectionSubscriptionFindManyMock.mockResolvedValue([{ sectionId: 1 }]);
    scheduleFindManyMock.mockResolvedValue([]);
    const { listSubscribedSchedules } = await import(
      "@/features/subscriptions/server/subscription-schedule-exam-read-model"
    );

    await listSubscribedSchedules("user-1", { limit: 10 });

    expectNarrowSectionInclude(
      sectionIncludeOf(scheduleFindManyMock.mock.calls[0][0]),
    );
  });

  it("loads only the published section context for calendar exam reads", async () => {
    userSectionSubscriptionFindManyMock.mockResolvedValue([{ sectionId: 1 }]);
    examFindManyMock.mockResolvedValue([]);
    const { listSubscribedExams } = await import(
      "@/features/subscriptions/server/subscription-schedule-exam-read-model"
    );

    await listSubscribedExams("user-1", { limit: 10 });

    expectNarrowSectionInclude(
      sectionIncludeOf(examFindManyMock.mock.calls[0][0]),
    );
  });

  it("keeps the catalog section relations requested by full calendars", async () => {
    userSectionSubscriptionFindManyMock.mockResolvedValue([{ sectionId: 1 }]);
    scheduleFindManyMock.mockResolvedValue([]);
    const { listSubscribedSchedules } = await import(
      "@/features/subscriptions/server/subscription-schedule-exam-read-model"
    );

    await listSubscribedSchedules("user-1", {
      limit: 10,
      sectionContext: "full",
    });

    expectCatalogSectionInclude(
      sectionIncludeOf(scheduleFindManyMock.mock.calls[0][0]),
    );
  });

  it("keeps the catalog section relations requested by the MCP exam list", async () => {
    userSectionSubscriptionFindManyMock.mockResolvedValue([{ sectionId: 1 }]);
    examFindManyMock.mockResolvedValue([]);
    const { listSubscribedExams } = await import(
      "@/features/subscriptions/server/subscription-schedule-exam-read-model"
    );

    await listSubscribedExams("user-1", { limit: 10, sectionContext: "full" });

    expectCatalogSectionInclude(
      sectionIncludeOf(examFindManyMock.mock.calls[0][0]),
    );
  });

  it("keeps the catalog section relations the GraphQL schedule page exposes", async () => {
    userSectionSubscriptionFindManyMock.mockResolvedValue([{ sectionId: 1 }]);
    scheduleFindManyMock.mockResolvedValue([]);
    scheduleCountMock.mockResolvedValue(0);
    const { listSubscribedSchedulePage } = await import(
      "@/features/subscriptions/server/subscription-schedule-exam-read-model"
    );

    await listSubscribedSchedulePage("user-1", {
      pagination: { page: 1, pageSize: 20 },
    });

    expectCatalogSectionInclude(
      sectionIncludeOf(scheduleFindManyMock.mock.calls[0][0]),
    );
  });

  it("keeps the catalog section relations the GraphQL exam page exposes", async () => {
    userSectionSubscriptionFindManyMock.mockResolvedValue([{ sectionId: 1 }]);
    examFindManyMock.mockResolvedValue([]);
    examCountMock.mockResolvedValue(0);
    const { listSubscribedExamPage } = await import(
      "@/features/subscriptions/server/subscription-schedule-exam-read-model"
    );

    await listSubscribedExamPage("user-1", {
      pagination: { page: 1, pageSize: 20 },
    });

    expectCatalogSectionInclude(
      sectionIncludeOf(examFindManyMock.mock.calls[0][0]),
    );
  });
});
