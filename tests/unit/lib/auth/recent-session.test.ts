import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionFromHeadersMock, sessionFindUniqueMock } = vi.hoisted(() => ({
  getSessionFromHeadersMock: vi.fn(),
  sessionFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

vi.mock("@/lib/db/auth-prisma", () => ({
  authPrisma: { session: { findUnique: sessionFindUniqueMock } },
}));

describe("authoritative recent session", () => {
  const now = new Date("2026-08-15T12:00:00.000Z");

  beforeEach(() => {
    getSessionFromHeadersMock.mockReset();
    sessionFindUniqueMock.mockReset();
    getSessionFromHeadersMock.mockResolvedValue({
      session: { id: "session-1" },
      user: { id: "user-1" },
    });
  });

  it("re-reads the database row and accepts a session inside the 15 minute window", async () => {
    sessionFindUniqueMock.mockResolvedValue({
      createdAt: new Date("2026-08-15T11:45:00.001Z"),
      expires: new Date("2026-08-15T13:00:00.000Z"),
      userId: "user-1",
    });
    const { resolveAuthoritativeRecentSession } = await import(
      "@/lib/auth/recent-session"
    );

    await expect(
      resolveAuthoritativeRecentSession(new Headers(), {
        expectedUserId: "user-1",
        now,
      }),
    ).resolves.toEqual({
      ok: true,
      sessionId: "session-1",
      userId: "user-1",
    });
    expect(sessionFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "session-1" },
      select: { createdAt: true, expires: true, userId: true },
    });
  });

  it("rejects the exact age boundary as stale", async () => {
    sessionFindUniqueMock.mockResolvedValue({
      createdAt: new Date("2026-08-15T11:45:00.000Z"),
      expires: new Date("2026-08-15T13:00:00.000Z"),
      userId: "user-1",
    });
    const { resolveAuthoritativeRecentSession } = await import(
      "@/lib/auth/recent-session"
    );

    await expect(
      resolveAuthoritativeRecentSession(new Headers(), { now }),
    ).resolves.toEqual({
      ok: false,
      reason: "session_not_fresh",
      sessionId: "session-1",
      userId: "user-1",
    });
  });

  it.each([
    ["revoked", null],
    [
      "expired",
      {
        createdAt: new Date("2026-08-15T11:59:00.000Z"),
        expires: now,
        userId: "user-1",
      },
    ],
    [
      "different owner",
      {
        createdAt: new Date("2026-08-15T11:59:00.000Z"),
        expires: new Date("2026-08-15T13:00:00.000Z"),
        userId: "user-2",
      },
    ],
  ])("rejects an authoritative %s session row", async (_case, row) => {
    sessionFindUniqueMock.mockResolvedValue(row);
    const { resolveAuthoritativeRecentSession } = await import(
      "@/lib/auth/recent-session"
    );

    await expect(
      resolveAuthoritativeRecentSession(new Headers(), { now }),
    ).resolves.toMatchObject({ ok: false, reason: "unauthenticated" });
  });
});
