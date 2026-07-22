import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  busFindUniqueMock,
  clickFindManyMock,
  clickUpsertMock,
  pinDeleteManyMock,
  pinFindManyMock,
  pinUpsertMock,
  withUserDbContextMock,
} = vi.hoisted(() => ({
  busFindUniqueMock: vi.fn(),
  clickFindManyMock: vi.fn(),
  clickUpsertMock: vi.fn(),
  pinDeleteManyMock: vi.fn(),
  pinFindManyMock: vi.fn(),
  pinUpsertMock: vi.fn(),
  withUserDbContextMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    busUserPreference: { findUnique: busFindUniqueMock },
    dashboardLinkClick: {
      findMany: clickFindManyMock,
      upsert: clickUpsertMock,
    },
    dashboardLinkPin: {
      deleteMany: pinDeleteManyMock,
      findMany: pinFindManyMock,
      upsert: pinUpsertMock,
    },
  },
  withUserDbContext: withUserDbContextMock,
}));

import { getBusPreference } from "@/features/bus/server/bus-preferences";
import { getSignedInDashboardLinksData } from "@/features/dashboard-links/server/dashboard-link-data";
import {
  recordDashboardLinkClick,
  updateDashboardLinkPinState,
} from "@/features/dashboard-links/server/dashboard-link-service";

describe("personal data RLS contexts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withUserDbContextMock.mockImplementation(
      async (_userId: string, action: (tx: unknown) => Promise<unknown>) =>
        action({}),
    );
  });

  it("uses one normalized context for a dashboard pin transaction", async () => {
    pinUpsertMock.mockResolvedValue({});
    pinFindManyMock
      .mockResolvedValueOnce([{ slug: "mail" }])
      .mockResolvedValueOnce([{ slug: "mail" }]);

    await expect(
      updateDashboardLinkPinState({
        action: "pin",
        slug: "mail",
        userId: " user-1 ",
      }),
    ).resolves.toEqual(["mail"]);

    expect(withUserDbContextMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );
    expect(pinUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { slug: "mail", userId: "user-1" },
      }),
    );
  });

  it("serializes dashboard reads inside one user transaction", async () => {
    clickFindManyMock.mockResolvedValue([]);
    pinFindManyMock.mockResolvedValue([]);

    await getSignedInDashboardLinksData("user-1");

    expect(withUserDbContextMock).toHaveBeenCalledOnce();
    expect(clickFindManyMock.mock.invocationCallOrder[0]).toBeLessThan(
      pinFindManyMock.mock.invocationCallOrder[0],
    );
  });

  it("routes click and bus preference reads through their owner context", async () => {
    clickUpsertMock.mockResolvedValue({});
    busFindUniqueMock.mockResolvedValue(null);

    await recordDashboardLinkClick("user-1", "mail");
    await getBusPreference("user-1");

    expect(withUserDbContextMock).toHaveBeenNthCalledWith(
      1,
      "user-1",
      expect.any(Function),
    );
    expect(withUserDbContextMock).toHaveBeenNthCalledWith(
      2,
      "user-1",
      expect.any(Function),
    );
  });
});
