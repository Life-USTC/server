import { beforeEach, describe, expect, it, vi } from "vitest";

const createHomeworkForSectionMock = vi.fn();
const getSessionFromHeadersMock = vi.fn();
const getViewerAuthDataForUserIdMock = vi.fn();

vi.mock("@/features/homeworks/server/homework-create", () => ({
  createHomeworkForSection: createHomeworkForSectionMock,
}));

vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

vi.mock("@/lib/auth/viewer-context", () => ({
  getViewerAuthDataForUserId: getViewerAuthDataForUserIdMock,
}));

function actionRequest() {
  const body = new FormData();
  body.set("sectionId", "1");
  body.set("title", "Blocked homework");

  return new Request(
    "https://life.example/dashboard/homeworks?/createHomework",
    {
      body,
      headers: { cookie: "better-auth.session_token=session-token" },
      method: "POST",
    },
  );
}

describe("dashboard homework page actions", () => {
  beforeEach(() => {
    createHomeworkForSectionMock.mockReset();
    getSessionFromHeadersMock.mockReset();
    getViewerAuthDataForUserIdMock.mockReset();
  });

  it("blocks suspended users before creating dashboard homework", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "suspended-user" },
    });
    getViewerAuthDataForUserIdMock.mockResolvedValue({
      user: { id: "suspended-user", isAdmin: false, image: null, name: null },
      suspension: { reason: "policy" },
    });
    const { createHomeworkDashboardAction } = await import(
      "@/features/dashboard/server/dashboard-homework-page-actions"
    );

    const result = await createHomeworkDashboardAction({
      locals: { locale: "en-us" },
      request: actionRequest(),
    });

    expect(result.status).toBe(403);
    expect(result.data).toEqual({
      error: "Your account is suspended and cannot update homework.",
    });
    expect(getViewerAuthDataForUserIdMock).toHaveBeenCalledWith(
      "suspended-user",
    );
    expect(createHomeworkForSectionMock).not.toHaveBeenCalled();
  });
});
