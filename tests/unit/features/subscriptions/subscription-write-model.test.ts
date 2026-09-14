import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";

const mocks = vi.hoisted(() => {
  const queryRaw = vi.fn();
  const userFindUnique = vi.fn();
  const sectionFindMany = vi.fn();
  const subscriptionFindFirst = vi.fn();
  const subscriptionCreateMany = vi.fn();
  const subscriptionDeleteMany = vi.fn();
  const transaction = {
    $queryRaw: queryRaw,
    user: { findUnique: userFindUnique },
    section: { findMany: sectionFindMany },
    userSectionSubscription: {
      findFirst: subscriptionFindFirst,
      createMany: subscriptionCreateMany,
      deleteMany: subscriptionDeleteMany,
    },
  };

  return {
    acquireLocks: vi.fn(),
    getCalendarSubscription: vi.fn(),
    invalidateCache: vi.fn(),
    queryRaw,
    resolveSections: vi.fn(),
    sectionFindFirst: vi.fn(),
    sectionFindMany,
    subscriptionCreateMany,
    subscriptionDeleteMany,
    subscriptionFindFirst,
    transaction,
    transactionContext: vi.fn(),
    userFindUnique,
  };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: { section: { findFirst: mocks.sectionFindFirst } },
  withUserDbContext: mocks.transactionContext,
}));

vi.mock("@/lib/db/section-lifecycle-lock", () => ({
  acquireSectionLifecycleAdvisoryLocks: mocks.acquireLocks,
}));

vi.mock("@/features/calendar/server/calendar-export-invalidation", () => ({
  scheduleInvalidateUserCalendarExportCache: mocks.invalidateCache,
}));

vi.mock(
  "@/features/subscriptions/server/subscription-calendar-read-model",
  () => ({
    getUserCalendarSubscription: mocks.getCalendarSubscription,
  }),
);

vi.mock(
  "@/features/subscriptions/server/subscription-section-resolver",
  () => ({
    resolveCalendarSubscriptionSections: mocks.resolveSections,
  }),
);

type Section = {
  code: string;
  course: { code: string };
  id: number;
  retiredAt: Date | null;
};

const USER_ID = "user-1";
const CALENDAR_SUBSCRIPTION = { sections: [{ id: 2 }] };

function section(id: number, options: Partial<Section> = {}): Section {
  return {
    code: `SEC-${id}`,
    course: { code: `COURSE-${id}` },
    id,
    retiredAt: null,
    ...options,
  };
}

function resolvedSections(sections: Section[]) {
  return {
    matchedCodes: sections.map((item) => item.code),
    matchedSectionIds: sections.map((item) => item.id),
    sections,
    total: sections.length,
    unmatchedCodes: [],
    unmatchedSectionIds: [],
  };
}

const tx = mocks.transaction as unknown as Prisma.TransactionClient;

describe("subscription write model", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transactionContext.mockImplementation(
      async (
        _userId: string,
        callback: (client: Prisma.TransactionClient) => Promise<unknown>,
      ) => callback(tx),
    );
    mocks.queryRaw.mockResolvedValue([{ id: USER_ID }]);
    mocks.userFindUnique.mockResolvedValue({
      id: USER_ID,
      sectionSubscriptions: [{ section: section(1) }],
    });
    mocks.sectionFindMany.mockResolvedValue([
      { id: 1, retiredAt: null },
      { id: 2, retiredAt: null },
      { id: 3, retiredAt: new Date("2026-01-01T00:00:00.000Z") },
    ]);
    mocks.subscriptionFindFirst.mockResolvedValue(null);
    mocks.subscriptionCreateMany.mockResolvedValue({ count: 1 });
    mocks.subscriptionDeleteMany.mockResolvedValue({ count: 1 });
    mocks.acquireLocks.mockResolvedValue(undefined);
    mocks.getCalendarSubscription.mockResolvedValue(CALENDAR_SUBSCRIPTION);
    mocks.invalidateCache.mockReturnValue(undefined);
    mocks.sectionFindFirst.mockResolvedValue({ id: 2 });
    mocks.resolveSections.mockResolvedValue(
      resolvedSections([section(2), section(3)]),
    );
  });

  it("checks an existing subscription inside the user's database context", async () => {
    mocks.subscriptionFindFirst.mockResolvedValueOnce({ sectionId: 7 });
    const { hasUserSubscribedSectionByJwId } = await import(
      "@/features/subscriptions/server/subscription-write-model"
    );

    await expect(hasUserSubscribedSectionByJwId(USER_ID, 7001)).resolves.toBe(
      true,
    );
    expect(mocks.transactionContext).toHaveBeenCalledWith(
      USER_ID,
      expect.any(Function),
    );
    expect(mocks.subscriptionFindFirst).toHaveBeenCalledWith({
      where: { userId: USER_ID, section: { jwId: 7001 } },
      select: { sectionId: true },
    });

    await expect(hasUserSubscribedSectionByJwId(USER_ID, 7002)).resolves.toBe(
      false,
    );
  });

  it("locks and mutates only existing active candidate sections", async () => {
    const { mutateUserSectionSubscriptionsInTransaction } = await import(
      "@/features/subscriptions/server/subscription-write-model"
    );

    await expect(
      mutateUserSectionSubscriptionsInTransaction(tx, {
        candidateSectionIds: [1, 2, 2, 3, 4],
        userId: USER_ID,
      }),
    ).resolves.toEqual({
      activeCandidateSectionIds: [1, 2],
      addedSectionIds: [2],
      unchangedSectionIds: [1],
    });
    expect(mocks.acquireLocks).toHaveBeenCalledWith(tx, [1, 2, 3, 4], "shared");
    expect(mocks.sectionFindMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2, 3, 4] } },
      select: { id: true, retiredAt: true },
    });
    expect(mocks.subscriptionCreateMany).toHaveBeenCalledWith({
      data: [{ userId: USER_ID, sectionId: 2 }],
      skipDuplicates: true,
    });
  });

  it("returns null before reading or writing when the user row cannot be locked", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    const { mutateUserSectionSubscriptionsInTransaction } = await import(
      "@/features/subscriptions/server/subscription-write-model"
    );

    await expect(
      mutateUserSectionSubscriptionsInTransaction(tx, {
        candidateSectionIds: [2],
        userId: USER_ID,
      }),
    ).resolves.toBeNull();
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.acquireLocks).not.toHaveBeenCalled();
  });

  it("returns null if the locked user disappears before the subscription read", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    const { mutateUserSectionSubscriptionsInTransaction } = await import(
      "@/features/subscriptions/server/subscription-write-model"
    );

    await expect(
      mutateUserSectionSubscriptionsInTransaction(tx, {
        candidateSectionIds: [2],
        userId: USER_ID,
      }),
    ).resolves.toBeNull();
    expect(mocks.acquireLocks).not.toHaveBeenCalled();
  });

  it("handles an empty candidate set without querying sections or creating rows", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: USER_ID,
      sectionSubscriptions: [],
    });
    const { mutateUserSectionSubscriptionsInTransaction } = await import(
      "@/features/subscriptions/server/subscription-write-model"
    );

    await expect(
      mutateUserSectionSubscriptionsInTransaction(tx, {
        candidateSectionIds: [],
        userId: USER_ID,
      }),
    ).resolves.toEqual({
      activeCandidateSectionIds: [],
      addedSectionIds: [],
      unchangedSectionIds: [],
    });
    expect(mocks.acquireLocks).toHaveBeenCalledWith(tx, [], "shared");
    expect(mocks.sectionFindMany).not.toHaveBeenCalled();
    expect(mocks.subscriptionCreateMany).not.toHaveBeenCalled();
  });

  it("appends active sections and reports already subscribed sections", async () => {
    const { appendUserSectionSubscriptions } = await import(
      "@/features/subscriptions/server/subscription-write-model"
    );

    await expect(
      appendUserSectionSubscriptions({
        locale: "zh-cn",
        sectionIds: [1, 2, 2],
        userId: USER_ID,
      }),
    ).resolves.toEqual({
      addedCount: 1,
      alreadySubscribedCount: 1,
      subscription: CALENDAR_SUBSCRIPTION,
    });
    expect(mocks.getCalendarSubscription).toHaveBeenCalledWith(
      USER_ID,
      "zh-cn",
    );
    expect(mocks.invalidateCache).toHaveBeenCalledWith(USER_ID);
  });

  it("does not schedule export invalidation when append cannot lock the user", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    const { appendUserSectionSubscriptions } = await import(
      "@/features/subscriptions/server/subscription-write-model"
    );

    await expect(
      appendUserSectionSubscriptions({ sectionIds: [2], userId: USER_ID }),
    ).resolves.toBeNull();
    expect(mocks.invalidateCache).not.toHaveBeenCalled();
    expect(mocks.getCalendarSubscription).not.toHaveBeenCalled();
  });

  it("imports codes while preserving normalized matches and separating new sections", async () => {
    const imported = [
      section(2, { code: "BIO-201" }),
      section(3, { code: "MATH-101" }),
    ];
    mocks.resolveSections.mockResolvedValue(resolvedSections(imported));
    mocks.userFindUnique.mockResolvedValue({
      id: USER_ID,
      sectionSubscriptions: [{ section: section(2, { code: "BIO-201" }) }],
    });
    mocks.sectionFindMany.mockResolvedValue([
      { id: 2, retiredAt: null },
      { id: 3, retiredAt: null },
    ]);
    const { importUserSectionSubscriptionsByCodes } = await import(
      "@/features/subscriptions/server/subscription-write-model"
    );

    const result = await importUserSectionSubscriptionsByCodes({
      codes: [" bio-201 ", "BIO-201", "unknown", "  "],
      locale: "en-us",
      semesterId: 12,
      userId: USER_ID,
    });

    expect(mocks.resolveSections).toHaveBeenCalledWith({
      codes: [" bio-201 ", "BIO-201", "unknown", "  "],
      locale: "en-us",
      semesterId: 12,
    });
    expect(result).toEqual({
      matches: {
        matchedCodes: ["bio-201"],
        matchedSectionIds: [2, 3],
        sections: imported,
        total: 2,
        unmatchedCodes: ["unknown"],
        unmatchedSectionIds: [],
      },
      addedSections: [imported[1]],
      alreadySubscribedSections: [imported[0]],
      subscription: CALENDAR_SUBSCRIPTION,
    });
  });

  it("returns null when code resolution or its transaction mutation fails", async () => {
    const { importUserSectionSubscriptionsByCodes } = await import(
      "@/features/subscriptions/server/subscription-write-model"
    );
    mocks.resolveSections.mockResolvedValueOnce(null);
    await expect(
      importUserSectionSubscriptionsByCodes({
        codes: ["BIO-201"],
        userId: USER_ID,
      }),
    ).resolves.toBeNull();
    expect(mocks.transactionContext).not.toHaveBeenCalled();

    mocks.resolveSections.mockResolvedValueOnce(resolvedSections([section(2)]));
    mocks.queryRaw.mockResolvedValueOnce([]);
    await expect(
      importUserSectionSubscriptionsByCodes({
        codes: ["BIO-201"],
        userId: USER_ID,
      }),
    ).resolves.toBeNull();
    expect(mocks.invalidateCache).not.toHaveBeenCalled();
  });

  it("adds resolved sections and reports requested IDs that were not accepted", async () => {
    const resolved = {
      ...resolvedSections([section(2), section(3)]),
      matchedSectionIds: [2, 3],
      unmatchedSectionIds: [8],
    };
    mocks.resolveSections.mockResolvedValue(resolved);
    mocks.userFindUnique.mockResolvedValue({
      id: USER_ID,
      sectionSubscriptions: [],
    });
    mocks.sectionFindMany.mockResolvedValue([{ id: 2, retiredAt: null }]);
    const { batchUpdateUserSectionSubscriptions } = await import(
      "@/features/subscriptions/server/subscription-write-model"
    );

    await expect(
      batchUpdateUserSectionSubscriptions({
        action: "add",
        codes: ["SEC-2", "SEC-2", "MISSING"],
        locale: "zh-cn",
        sectionIds: [2, 8, 2],
        semesterId: 12,
        userId: USER_ID,
      }),
    ).resolves.toEqual({
      action: "add",
      addedCount: 1,
      matchedCodes: ["SEC-2"],
      matchedSectionIds: [2],
      sections: [resolved.sections[0]],
      subscription: CALENDAR_SUBSCRIPTION,
      total: 1,
      unchangedCount: 0,
      unmatchedCodes: ["MISSING"],
      unmatchedSectionIds: [8],
      removedCount: 0,
    });
    expect(mocks.resolveSections).toHaveBeenCalledWith({
      codes: ["SEC-2", "SEC-2", "MISSING"],
      includeRetired: false,
      locale: "zh-cn",
      sectionIds: [2, 8, 2],
      semesterId: 12,
    });
  });

  it("returns null from a batch add when the locked mutation fails", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    const { batchUpdateUserSectionSubscriptions } = await import(
      "@/features/subscriptions/server/subscription-write-model"
    );

    await expect(
      batchUpdateUserSectionSubscriptions({
        action: "add",
        sectionIds: [2],
        userId: USER_ID,
      }),
    ).resolves.toBeNull();
    expect(mocks.getCalendarSubscription).not.toHaveBeenCalled();
  });

  it("removes deduplicated targets, including retired sections resolved for removal", async () => {
    const retired = section(3, {
      retiredAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const resolved = {
      ...resolvedSections([section(2), retired]),
      matchedSectionIds: [2, 3],
      unmatchedSectionIds: [9],
    };
    mocks.resolveSections.mockResolvedValue(resolved);
    mocks.subscriptionDeleteMany.mockResolvedValue({ count: 1 });
    const { batchUpdateUserSectionSubscriptions } = await import(
      "@/features/subscriptions/server/subscription-write-model"
    );

    await expect(
      batchUpdateUserSectionSubscriptions({
        action: "remove",
        codes: ["SEC-2"],
        locale: "en-us",
        sectionIds: [2, 3, 3],
        semesterId: 12,
        userId: USER_ID,
      }),
    ).resolves.toEqual({
      action: "remove",
      addedCount: 0,
      matchedCodes: resolved.matchedCodes,
      matchedSectionIds: [2, 3],
      sections: resolved.sections,
      subscription: CALENDAR_SUBSCRIPTION,
      total: 2,
      unchangedCount: 1,
      unmatchedCodes: [],
      unmatchedSectionIds: [],
      removedCount: 1,
    });
    expect(mocks.resolveSections).toHaveBeenCalledWith({
      codes: ["SEC-2"],
      includeRetired: true,
      locale: "en-us",
      sectionIds: [2, 3, 3],
      semesterId: 12,
    });
    expect(mocks.acquireLocks).toHaveBeenCalledWith(tx, [2, 3], "shared");
    expect(mocks.subscriptionDeleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, sectionId: { in: [2, 3] } },
    });
  });

  it("removes no rows for an empty target and reports a missing locked user", async () => {
    const {
      mutateUserSectionSubscriptionsInTransaction,
      removeUserSectionSubscriptions,
    } = await import(
      "@/features/subscriptions/server/subscription-write-model"
    );
    await expect(removeUserSectionSubscriptions(USER_ID, [])).resolves.toBe(
      true,
    );
    expect(mocks.subscriptionDeleteMany).not.toHaveBeenCalled();

    mocks.queryRaw.mockResolvedValueOnce([]);
    await expect(
      removeUserSectionSubscriptions(USER_ID, [2]),
    ).resolves.toBeNull();

    mocks.queryRaw.mockResolvedValueOnce([]);
    await expect(
      mutateUserSectionSubscriptionsInTransaction(tx, {
        candidateSectionIds: [2],
        userId: USER_ID,
      }),
    ).resolves.toBeNull();
  });

  it("returns null when batch removal cannot lock the user", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    const { batchUpdateUserSectionSubscriptions } = await import(
      "@/features/subscriptions/server/subscription-write-model"
    );

    await expect(
      batchUpdateUserSectionSubscriptions({
        action: "remove",
        sectionIds: [2],
        userId: USER_ID,
      }),
    ).resolves.toBeNull();
  });

  it("subscribes and unsubscribes by JW ID with the correct retired-row policy", async () => {
    const { subscribeUserToSectionByJwId, unsubscribeUserFromSectionByJwId } =
      await import("@/features/subscriptions/server/subscription-write-model");

    await expect(
      subscribeUserToSectionByJwId(USER_ID, 2002, "zh-cn"),
    ).resolves.toEqual(CALENDAR_SUBSCRIPTION);
    expect(mocks.sectionFindFirst).toHaveBeenCalledWith({
      where: { jwId: 2002, retiredAt: null },
      select: { id: true },
    });

    mocks.sectionFindFirst.mockResolvedValueOnce({ id: 3 });
    await expect(
      unsubscribeUserFromSectionByJwId(USER_ID, 3003, "en-us"),
    ).resolves.toEqual(CALENDAR_SUBSCRIPTION);
    expect(mocks.sectionFindFirst).toHaveBeenLastCalledWith({
      where: { jwId: 3003 },
      select: { id: true },
    });
    expect(mocks.subscriptionDeleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, sectionId: { in: [3] } },
    });
  });

  it("rejects a JW subscription when the row is retired or the user mutation fails", async () => {
    const { subscribeUserToSectionByJwId, unsubscribeUserFromSectionByJwId } =
      await import("@/features/subscriptions/server/subscription-write-model");
    mocks.sectionFindFirst.mockResolvedValueOnce(null);
    await expect(
      subscribeUserToSectionByJwId(USER_ID, 4040),
    ).resolves.toBeNull();

    mocks.sectionFindFirst.mockResolvedValueOnce({ id: 3 });
    mocks.sectionFindMany.mockResolvedValueOnce([
      { id: 3, retiredAt: new Date("2026-01-01T00:00:00.000Z") },
    ]);
    await expect(
      subscribeUserToSectionByJwId(USER_ID, 3003),
    ).resolves.toBeNull();

    mocks.sectionFindFirst.mockResolvedValueOnce(null);
    await expect(
      unsubscribeUserFromSectionByJwId(USER_ID, 4041),
    ).resolves.toBeNull();
  });

  it("sets a subscription on and off, while allowing retired rows only for removal", async () => {
    const { setUserSectionSubscriptionByJwId } = await import(
      "@/features/subscriptions/server/subscription-write-model"
    );

    await expect(
      setUserSectionSubscriptionByJwId({
        sectionJwId: 2002,
        subscribed: true,
        userId: USER_ID,
      }),
    ).resolves.toEqual({ sectionJwId: 2002, subscribed: true });
    expect(mocks.sectionFindFirst).toHaveBeenCalledWith({
      where: { jwId: 2002, retiredAt: null },
      select: { id: true },
    });

    mocks.sectionFindFirst.mockResolvedValueOnce({ id: 3 });
    await expect(
      setUserSectionSubscriptionByJwId({
        sectionJwId: 3003,
        subscribed: false,
        userId: USER_ID,
      }),
    ).resolves.toEqual({ sectionJwId: 3003, subscribed: false });
    expect(mocks.sectionFindFirst).toHaveBeenLastCalledWith({
      where: { jwId: 3003 },
      select: { id: true },
    });
    expect(mocks.subscriptionDeleteMany).toHaveBeenLastCalledWith({
      where: { userId: USER_ID, sectionId: 3 },
    });
  });

  it("returns null for a set operation when the active candidate is not returned", async () => {
    mocks.sectionFindFirst.mockResolvedValue({ id: 2 });
    mocks.sectionFindMany.mockResolvedValue([]);
    const { setUserSectionSubscriptionByJwId } = await import(
      "@/features/subscriptions/server/subscription-write-model"
    );

    await expect(
      setUserSectionSubscriptionByJwId({
        sectionJwId: 2002,
        subscribed: true,
        userId: USER_ID,
      }),
    ).resolves.toBeNull();
  });
});
