import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAccessRecordMock } = vi.hoisted(() => ({
  getAccessRecordMock: vi.fn(),
}));

vi.mock("@/features/calendar/server/calendar-export-data", () => ({
  getUserCalendarAccessRecord: getAccessRecordMock,
}));

import {
  authorizeUserCalendarFeed,
  parseUserCalendarIdentifier,
} from "@/features/calendar/server/calendar-feed-access";

describe("calendar feed access rules", () => {
  beforeEach(() => {
    getAccessRecordMock.mockReset();
  });

  it("splits an embedded path token from the user id", () => {
    expect(parseUserCalendarIdentifier("user-1")).toEqual({
      userId: "user-1",
      tokenFromPath: null,
    });
    expect(parseUserCalendarIdentifier("user-1:abc:def")).toEqual({
      userId: "user-1",
      tokenFromPath: "abc:def",
    });
  });

  it("accepts a matching path token without consulting the session", async () => {
    getAccessRecordMock.mockResolvedValue({ calendarFeedToken: "tok" });
    const resolveViewerUserId = vi.fn();

    await expect(
      authorizeUserCalendarFeed({
        rawUserId: "user-1:tok",
        resolveViewerUserId,
      }),
    ).resolves.toEqual({ ok: true, userId: "user-1" });
    expect(resolveViewerUserId).not.toHaveBeenCalled();
  });

  it.each([
    ["user-1: current ", "revoked"],
    ["user-1: ", " current "],
  ])(
    "resolves path and query credentials for %s",
    async (rawUserId, queryToken) => {
      getAccessRecordMock.mockResolvedValue({ calendarFeedToken: "current" });
      const resolveViewerUserId = vi.fn();

      await expect(
        authorizeUserCalendarFeed({
          rawUserId,
          queryToken,
          resolveViewerUserId,
        }),
      ).resolves.toEqual({ ok: true, userId: "user-1" });
      expect(getAccessRecordMock).toHaveBeenCalledWith("user-1");
      expect(resolveViewerUserId).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["wrong token", { calendarFeedToken: "new" }, "token_revoked"],
    ["unknown user", null, "not_found"],
  ])("denies a query token for %s", async (_name, record, reason) => {
    getAccessRecordMock.mockResolvedValue(record);

    await expect(
      authorizeUserCalendarFeed({
        queryToken: "old",
        rawUserId: "user-1",
        resolveViewerUserId: vi.fn(),
      }),
    ).resolves.toEqual({ ok: false, reason });
  });

  it("requires the signed-in owner when no token is supplied", async () => {
    getAccessRecordMock.mockResolvedValue({ calendarFeedToken: "tok" });
    const decide = (viewer: string | null) =>
      authorizeUserCalendarFeed({
        rawUserId: "user-1",
        resolveViewerUserId: async () => viewer,
      });

    await expect(decide(null)).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
    });
    await expect(decide("user-2")).resolves.toEqual({
      ok: false,
      reason: "forbidden",
    });
    await expect(decide("user-1")).resolves.toEqual({
      ok: true,
      userId: "user-1",
    });
  });

  it("returns not found when the signed-in owner's record no longer exists", async () => {
    getAccessRecordMock.mockResolvedValue(null);

    await expect(
      authorizeUserCalendarFeed({
        rawUserId: "user-1",
        resolveViewerUserId: async () => "user-1",
      }),
    ).resolves.toEqual({ ok: false, reason: "not_found" });
  });
});
