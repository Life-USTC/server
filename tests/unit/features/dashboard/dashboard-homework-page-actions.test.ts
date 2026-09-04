import { beforeEach, describe, expect, it, vi } from "vitest";

const createHomeworkForSectionMock = vi.fn();
const getSessionFromHeadersMock = vi.fn();

vi.mock("@/features/homeworks/server/homework-create", () => ({
  createHomeworkForSection: createHomeworkForSectionMock,
}));

vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

function actionRequest() {
  const body = new FormData();
  body.set("sectionId", "1");
  body.set("title", "Blocked homework");

  return new Request(
    "https://life.example/workspace/homeworks?/createHomework",
    {
      body,
      headers: { cookie: "better-auth.session_token=session-token" },
      method: "POST",
    },
  );
}

describe("仪表盘作业页面操作", () => {
  beforeEach(() => {
    createHomeworkForSectionMock.mockReset();
    getSessionFromHeadersMock.mockReset();
  });

  it("映射被停用账户的仪表盘作业创建失败", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "suspended-user" },
    });
    createHomeworkForSectionMock.mockResolvedValue({
      ok: false,
      error: "suspended",
      reason: "policy",
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
    expect(createHomeworkForSectionMock).toHaveBeenCalledWith(
      "suspended-user",
      expect.objectContaining({ sectionId: 1, title: "Blocked homework" }),
    );
  });
});
