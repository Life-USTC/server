import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";

const {
  collectFeatureEventMock,
  createHomeworkForSectionMock,
  getSessionFromHeadersMock,
} = vi.hoisted(() => ({
  collectFeatureEventMock: vi.fn(),
  createHomeworkForSectionMock: vi.fn(),
  getSessionFromHeadersMock: vi.fn(),
}));

vi.mock("@/lib/db/observability-context", async () => ({
  ...(await vi.importActual<typeof import("@/lib/db/observability-context")>(
    "@/lib/db/observability-context",
  )),
  collectFeatureEvent: collectFeatureEventMock,
}));

vi.mock("@/features/homeworks/server/homework-create", () => ({
  createHomeworkForSection: createHomeworkForSectionMock,
}));

vi.mock("@/lib/auth/core", () => ({
  getSessionFromHeaders: getSessionFromHeadersMock,
}));

beforeEach(() => {
  createHomeworkForSectionMock.mockReset();
  getSessionFromHeadersMock.mockReset();
  collectFeatureEventMock.mockReset();
});

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
  it("映射被停用账户的仪表盘作业创建失败", async () => {
    getSessionFromHeadersMock.mockResolvedValue({
      user: { id: "suspended-user" },
    });
    createHomeworkForSectionMock.mockResolvedValue({
      ok: false,
      error: "suspended",
      reason: "policy",
    });
    const { createHomeworkWorkspaceAction } = await import(
      "@/features/workspace/server/workspace-homework-page-actions"
    );

    const result = await createHomeworkWorkspaceAction({
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

describe("homework action metric boundary", () => {
  it.each([
    [{ ok: true }, "success", "none"],
    [{ ok: false, error: "forbidden" }, "rejected", "forbidden"],
  ])(
    "preserves action redirect/failure and avoids an extra session query",
    async (result, outcome, errorClass) => {
      getSessionFromHeadersMock
        .mockReset()
        .mockResolvedValue({ user: { id: "user" } });
      createHomeworkForSectionMock.mockReset().mockResolvedValue(result);
      const { createHomeworkWorkspaceAction } = await import(
        "@/features/workspace/server/workspace-homework-page-actions"
      );
      await runWithCloudflareRuntimeEnv({}, async () => {
        const action = createHomeworkWorkspaceAction({
          locals: { locale: "en-us" },
          request: actionRequest(),
        });
        if (outcome === "success")
          await expect(action).rejects.toMatchObject({
            status: 303,
            location: "/workspace/homeworks",
          });
        else await expect(action).resolves.toMatchObject({ status: 403 });
      });
      expect(getSessionFromHeadersMock).toHaveBeenCalledTimes(1);
      expect(createHomeworkForSectionMock).toHaveBeenCalledTimes(1);
      expect(collectFeatureEventMock).toHaveBeenCalledTimes(1);
      expect(collectFeatureEventMock.mock.calls[0]?.[0]).toMatchObject({
        feature: "community.section-homework",
        operation: "create",
        protocol: "web",
        surface: "web",
        authMode: "session",
        outcome,
        errorClass,
        userId: "user",
      });
    },
  );
});

it("records an unauthenticated action without attempting a write", async () => {
  getSessionFromHeadersMock.mockReset().mockResolvedValue(null);
  createHomeworkForSectionMock.mockReset();
  const { createHomeworkWorkspaceAction } = await import(
    "@/features/workspace/server/workspace-homework-page-actions"
  );
  await runWithCloudflareRuntimeEnv({}, async () => {
    await expect(
      createHomeworkWorkspaceAction({
        locals: { locale: "en-us" },
        request: actionRequest(),
      }),
    ).resolves.toMatchObject({ status: 401 });
  });
  expect(getSessionFromHeadersMock).toHaveBeenCalledTimes(1);
  expect(createHomeworkForSectionMock).not.toHaveBeenCalled();
  expect(collectFeatureEventMock).toHaveBeenCalledTimes(1);
  expect(collectFeatureEventMock.mock.calls[0]?.[0]).toMatchObject({
    feature: "community.section-homework",
    operation: "create",
    protocol: "web",
    surface: "web",
    authMode: "anonymous",
    outcome: "rejected",
    errorClass: "unauthorized",
    userId: null,
  });
});
