import { beforeEach, describe, expect, it, vi } from "vitest";

const subscribeUserToSectionByJwIdMock = vi.fn();
const unsubscribeUserFromSectionByJwIdMock = vi.fn();

vi.mock("@/features/subscriptions/server/subscriptions", () => ({
  subscribeUserToSectionByJwId: subscribeUserToSectionByJwIdMock,
  unsubscribeUserFromSectionByJwId: unsubscribeUserFromSectionByJwIdMock,
}));

function actionInput(jwId = "99999999") {
  return {
    locals: {
      authUser: {
        email: "user@example.test",
        id: "user-1",
        image: null,
        isAdmin: false,
        name: "User",
        profilePictures: [],
        username: "user",
      },
      locale: "en-us" as const,
    },
    params: { jwId },
    request: new Request("http://localhost/sections/99999999"),
  };
}

describe("课程详情订阅动作", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("订阅目标不存在时返回 404", async () => {
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

  it("取消订阅目标不存在时返回 404", async () => {
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

  it("使用 hook 已解析的匿名 locals 拒绝订阅", async () => {
    const { subscribeSectionAction } = await import(
      "@/features/section-detail/server/section-detail-subscription-actions"
    );
    const input = {
      ...actionInput(),
      locals: { authUser: null, locale: "en-us" as const },
    };

    const result = await subscribeSectionAction(input);

    expect(result).toMatchObject({ status: 401 });
    expect(subscribeUserToSectionByJwIdMock).not.toHaveBeenCalled();
  });
});
