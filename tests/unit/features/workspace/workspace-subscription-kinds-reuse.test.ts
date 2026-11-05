import { beforeEach, expect, it, vi } from "vitest";

const { findUser, findMemberships, withUserDbContextMock, listSections } =
  vi.hoisted(() => ({
    findUser: vi.fn(),
    findMemberships: vi.fn(),
    withUserDbContextMock: vi.fn(),
    listSections: vi.fn(),
  }));
vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: withUserDbContextMock,
  getPrisma: () => ({ semester: { findMany: async () => [] } }),
}));
vi.mock(
  "@/features/subscriptions/server/subscription-calendar-read-model",
  () => ({
    getCalendarSubscriptionUrl: async () => null,
  }),
);
vi.mock("@/features/subscriptions/server/subscription-tab-sections", () => ({
  listSubscribedSectionsForSubscriptionsTab: listSections,
  subscriptionSectionFromRow: (row: { id: number }) => row,
}));

import { getSubscriptionsTabData } from "@/features/subscriptions/server/subscription-tab-read-model";
import { getWorkspaceUserContext } from "@/features/workspace/server/workspace-user-context";

beforeEach(() => {
  vi.clearAllMocks();
  withUserDbContextMock.mockImplementation(async (_userId, action) =>
    action({
      user: { findUnique: findUser },
      userSectionSubscription: { findMany: findMemberships },
    }),
  );
  findUser.mockResolvedValue({
    id: "viewer",
    name: "Viewer",
    username: null,
    calendarFeedToken: null,
    sectionSubscriptions: [
      { kind: "regular", section: { id: 10, retiredAt: null, semesterId: 1 } },
      {
        kind: "teaching_assistant",
        section: { id: 20, retiredAt: null, semesterId: 1 },
      },
    ],
  });
  findMemberships.mockResolvedValue([
    { sectionId: 10, kind: "regular" },
    { sectionId: 20, kind: "teaching_assistant" },
  ]);
  // The projection must also reject an unexpected foreign row from its reader.
  listSections.mockResolvedValue([{ id: 10 }, { id: 20 }, { id: 90 }]);
});

it("reuses the actor snapshot without another membership transaction", async () => {
  const context = await getWorkspaceUserContext("viewer");
  if (!context) throw new Error("Expected viewer context");
  expect(findUser).toHaveBeenCalledWith(
    expect.objectContaining({
      select: expect.objectContaining({
        sectionSubscriptions: expect.objectContaining({
          select: expect.objectContaining({ kind: true }),
        }),
      }),
    }),
  );
  const result = await getSubscriptionsTabData("viewer", "en-us", {
    sectionIds: [...context.sectionIds, 90],
    subscriptionKinds: context.subscriptionKinds,
  });
  expect(withUserDbContextMock).toHaveBeenCalledOnce();
  expect(findMemberships).not.toHaveBeenCalled();
  expect(listSections).toHaveBeenCalledWith("viewer", "en-us", {
    sectionIds: [10, 20],
    includeExams: undefined,
  });
  expect(result.subscriptions[0].sections).toEqual([
    { id: 10, kind: "regular" },
    { id: 20, kind: "teaching_assistant" },
  ]);
  if (!context.subscriptionKinds)
    throw new Error("Expected membership snapshot");
  expect([...context.subscriptionKinds.kinds]).toEqual([
    [10, "regular"],
    [20, "teaching_assistant"],
  ]);
});

it.each([
  undefined,
  { userId: "other-viewer", kinds: new Map([[90, "auditor" as const]]) },
])(
  "reads actor memberships when the snapshot is absent or belongs to another actor",
  async (subscriptionKinds) => {
    const result = await getSubscriptionsTabData("viewer", "en-us", {
      sectionIds: [10, 20, 90],
      subscriptionKinds,
    });
    expect(withUserDbContextMock).toHaveBeenCalledOnce();
    expect(withUserDbContextMock).toHaveBeenCalledWith(
      "viewer",
      expect.any(Function),
    );
    expect(findMemberships).toHaveBeenCalledWith({
      where: { userId: "viewer" },
      select: { sectionId: true, kind: true },
    });
    expect(listSections).toHaveBeenCalledWith("viewer", "en-us", {
      sectionIds: [10, 20],
      includeExams: undefined,
    });
    expect(result.subscriptions[0].sections).toEqual([
      { id: 10, kind: "regular" },
      { id: 20, kind: "teaching_assistant" },
    ]);
  },
);

it("retains a known empty same-user snapshot without refetching", async () => {
  const result = await getSubscriptionsTabData("viewer", "en-us", {
    sectionIds: [90],
    subscriptionKinds: { userId: "viewer", kinds: new Map() },
  });
  expect(withUserDbContextMock).not.toHaveBeenCalled();
  expect(findMemberships).not.toHaveBeenCalled();
  expect(listSections).toHaveBeenCalledWith("viewer", "en-us", {
    sectionIds: [],
    includeExams: undefined,
  });
  expect(result.subscriptions.flatMap((item) => item.sections)).toEqual([]);
});
