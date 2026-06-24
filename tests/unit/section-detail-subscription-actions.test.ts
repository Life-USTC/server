import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionFromHeadersMock = vi.fn();
const subscribeUserToSectionByJwIdMock = vi.fn();
const unsubscribeUserFromSectionByJwIdMock = vi.fn();

vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

vi.mock("@/features/home/server/subscriptions", () => ({
  subscribeUserToSectionByJwId: subscribeUserToSectionByJwIdMock,
  unsubscribeUserFromSectionByJwId: unsubscribeUserFromSectionByJwIdMock,
}));

function actionInput(jwId = "99999999") {
  return {
    locals: { locale: "en-us" as const },
    params: { jwId },
    request: new Request("http://localhost/sections/99999999"),
  };
}

describe("section detail subscription actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionFromHeadersMock.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("returns 404 when subscribe target is missing", async () => {
    subscribeUserToSectionByJwIdMock.mockResolvedValue(null);
    const { subscribeSectionAction } = await import(
      "@/features/section-detail/server/section-detail-subscription-actions"
    );

    const result = await subscribeSectionAction(actionInput());

    expect(result).toMatchObject({ status: 404 });
    expect(subscribeUserToSectionByJwIdMock).toHaveBeenCalledWith(
      "user-1",
      99999999,
    );
  });

  it("returns 404 when unsubscribe target is missing", async () => {
    unsubscribeUserFromSectionByJwIdMock.mockResolvedValue(null);
    const { unsubscribeSectionAction } = await import(
      "@/features/section-detail/server/section-detail-subscription-actions"
    );

    const result = await unsubscribeSectionAction(actionInput());

    expect(result).toMatchObject({ status: 404 });
    expect(unsubscribeUserFromSectionByJwIdMock).toHaveBeenCalledWith(
      "user-1",
      99999999,
    );
  });
});
