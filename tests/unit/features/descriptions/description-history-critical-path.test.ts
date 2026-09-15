import { beforeEach, describe, expect, it, vi } from "vitest";

const { descriptionFindFirstMock, historyFindManyMock } = vi.hoisted(() => ({
  descriptionFindFirstMock: vi.fn(),
  historyFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    description: { findFirst: descriptionFindFirstMock },
    descriptionEdit: { findMany: historyFindManyMock },
  },
}));

const viewer = {
  image: null,
  isAdmin: false,
  isAuthenticated: false,
  isSuspended: false,
  name: null,
  suspensionExpiresAt: null,
  suspensionReason: null,
  userId: null,
};

const target = {
  ensureExists: vi.fn(),
  targetId: 1,
  where: { courseId: 1 },
};

describe("description history critical path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    descriptionFindFirstMock.mockResolvedValue({
      content: "Current description",
      id: "description-1",
      lastEditedAt: null,
      lastEditedBy: null,
      updatedAt: new Date("2026-07-29T00:00:00Z"),
    });
    historyFindManyMock.mockResolvedValue([
      {
        createdAt: new Date("2026-07-28T00:00:00Z"),
        editor: null,
        id: "history-1",
        nextContent: "Current description",
        previousContent: "Previous description",
      },
    ]);
  });

  it("skips history when the active detail tab cannot render it", async () => {
    const { getResolvedDescriptionPayload } = await import(
      "@/features/descriptions/server/descriptions-server"
    );

    const result = await getResolvedDescriptionPayload(target, viewer, {
      includeHistory: false,
    });

    expect(result.description.content).toBe("Current description");
    expect(result.history).toEqual([]);
    expect(historyFindManyMock).not.toHaveBeenCalled();
  });

  it("keeps history enabled by default", async () => {
    const { getResolvedDescriptionPayload } = await import(
      "@/features/descriptions/server/descriptions-server"
    );

    const result = await getResolvedDescriptionPayload(target, viewer);

    expect(result.history).toHaveLength(1);
    expect(historyFindManyMock).toHaveBeenCalledOnce();
  });
});
