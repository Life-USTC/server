import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureUserCalendarFeedToken } from "@/features/subscriptions/server/calendar-feed-token";
import { getCalendarSubscriptionUrl } from "@/features/subscriptions/server/subscription-calendar-read-model";
import { randomBytesBase64Url } from "@/lib/crypto/web-crypto";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/crypto/web-crypto", () => ({
  randomBytesBase64Url: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: vi.fn(),
}));

const findUniqueMock = vi.mocked(prisma.user.findUnique);
const randomBytesBase64UrlMock = vi.mocked(randomBytesBase64Url);
const updateMock = vi.mocked(prisma.user.update);
const updateManyMock = vi.mocked(prisma.user.updateMany);

function userWithToken(calendarFeedToken: string | null) {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    calendarFeedToken,
    createdAt: now,
    email: "user@example.com",
    emailVerified: true,
    id: "user-1",
    image: null,
    isAdmin: false,
    name: "User",
    profilePictures: [],
    updatedAt: now,
    username: null,
  };
}

describe("ensureUserCalendarFeedToken 日历订阅令牌", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("首次创建成功时返回生成的令牌", async () => {
    findUniqueMock.mockResolvedValueOnce(userWithToken(null));
    randomBytesBase64UrlMock.mockReturnValue("generated-token");
    updateManyMock.mockResolvedValueOnce({ count: 1 });

    await expect(ensureUserCalendarFeedToken("user-1")).resolves.toBe(
      "generated-token",
    );

    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: "user-1", calendarFeedToken: null },
      data: { calendarFeedToken: "generated-token" },
    });
    expect(findUniqueMock).toHaveBeenCalledTimes(1);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("并发写入由另一方完成时重读并返回持久化的令牌", async () => {
    findUniqueMock
      .mockResolvedValueOnce(userWithToken(null))
      .mockResolvedValueOnce(userWithToken("persisted-token"));
    randomBytesBase64UrlMock.mockReturnValue("discarded-token");
    updateManyMock.mockResolvedValueOnce({ count: 0 });

    await expect(ensureUserCalendarFeedToken("user-1")).resolves.toBe(
      "persisted-token",
    );

    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: "user-1", calendarFeedToken: null },
      data: { calendarFeedToken: "discarded-token" },
    });
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("getCalendarSubscriptionUrl 日历订阅地址", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("已有可信令牌时不重复查询用户", async () => {
    await expect(
      getCalendarSubscriptionUrl("user-1", "existing-token"),
    ).resolves.toBe("/api/calendar-feeds/user-1:existing-token.ics");

    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("显式 null 仍初始化令牌且不增加前置查询", async () => {
    findUniqueMock.mockResolvedValueOnce(userWithToken(null));
    randomBytesBase64UrlMock.mockReturnValue("generated-token");
    updateManyMock.mockResolvedValueOnce({ count: 1 });

    await expect(getCalendarSubscriptionUrl("user-1", null)).resolves.toBe(
      "/api/calendar-feeds/user-1:generated-token.ics",
    );

    expect(findUniqueMock).toHaveBeenCalledTimes(1);
  });

  it("省略令牌时保留用户查询回退", async () => {
    findUniqueMock.mockResolvedValueOnce(userWithToken("stored-token"));

    await expect(getCalendarSubscriptionUrl("user-1")).resolves.toBe(
      "/api/calendar-feeds/user-1:stored-token.ics",
    );

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { id: true, calendarFeedToken: true },
    });
  });

  it("令牌写入失败时返回 null 而不抛出", async () => {
    findUniqueMock.mockResolvedValueOnce(userWithToken(null));
    randomBytesBase64UrlMock.mockReturnValue("generated-token");
    updateManyMock.mockRejectedValueOnce(
      Object.assign(new Error("permission denied"), {
        code: "42501",
        name: "error",
      }),
    );

    await expect(
      getCalendarSubscriptionUrl("user-1", null),
    ).resolves.toBeNull();
  });
});
