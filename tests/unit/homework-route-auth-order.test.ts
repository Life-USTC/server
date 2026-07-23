import { afterEach, describe, expect, it, vi } from "vitest";

const {
  createHomeworkForSectionMock,
  requireAuthMock,
  requireHomeworkItemByIdMock,
  setHomeworkCompletionsMock,
  updateHomeworkMock,
} = vi.hoisted(() => ({
  createHomeworkForSectionMock: vi.fn(),
  requireAuthMock: vi.fn(),
  requireHomeworkItemByIdMock: vi.fn(),
  setHomeworkCompletionsMock: vi.fn(),
  updateHomeworkMock: vi.fn(),
}));

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/features/homeworks/server/homework-create", () => ({
  createHomeworkForSection: createHomeworkForSectionMock,
}));

vi.mock("@/features/homeworks/server/homework-read-model", () => ({
  requireHomeworkItemById: requireHomeworkItemByIdMock,
}));

vi.mock("@/features/homeworks/server/homework-mutations", () => ({
  deleteHomework: vi.fn(),
  updateHomework: updateHomeworkMock,
}));

vi.mock("@/features/homeworks/server/homework-completion", () => ({
  setHomeworkCompletions: setHomeworkCompletionsMock,
}));

function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function jsonRequest(method: string, body: string) {
  return new Request("https://example.test/api/community/section-homeworks", {
    body,
    headers: { "Content-Type": "application/json" },
    method,
  });
}

describe("homework 变更路由的认证顺序", () => {
  afterEach(() => {
    requireAuthMock.mockReset();
    createHomeworkForSectionMock.mockReset();
    requireHomeworkItemByIdMock.mockReset();
    setHomeworkCompletionsMock.mockReset();
    updateHomeworkMock.mockReset();
    vi.resetModules();
  });

  it("在解析 JSON 请求体前先认证作业创建", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());
    const { postHomeworkRoute } = await import(
      "@/lib/api/routes/homework-mutation-routes"
    );

    const response = await postHomeworkRoute(jsonRequest("POST", "{"));

    expect(response.status).toBe(401);
    expect(requireAuthMock).toHaveBeenCalledOnce();
  });

  it("作业创建传入冲突的 section 标识符时返回 400", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    createHomeworkForSectionMock.mockResolvedValue({
      ok: false,
      error: "mismatch",
    });
    const { postHomeworkRoute } = await import(
      "@/lib/api/routes/homework-mutation-routes"
    );

    const response = await postHomeworkRoute(
      jsonRequest(
        "POST",
        JSON.stringify({
          sectionId: 12,
          sectionJwId: 5678,
          title: "Conflicting section refs",
        }),
      ),
    );

    expect(response.status).toBe(400);
    expect(createHomeworkForSectionMock).toHaveBeenCalledWith("user-1", {
      description: "",
      isMajor: false,
      publishedAt: null,
      requiresTeam: false,
      sectionId: 12,
      sectionJwId: 5678,
      submissionDueAt: null,
      submissionStartAt: null,
      title: "Conflicting section refs",
    });
  });

  it("将请求 locale 传递给更新作业的响应读取", async () => {
    requireAuthMock.mockResolvedValue({ userId: "user-1" });
    updateHomeworkMock.mockResolvedValue({ ok: true });
    requireHomeworkItemByIdMock.mockResolvedValue({ id: "homework-1" });
    const { patchHomeworkRoute } = await import(
      "@/lib/api/routes/homework-mutation-routes"
    );

    const response = await patchHomeworkRoute(
      new Request(
        "https://example.test/api/community/section-homeworks/homework-1",
        {
          body: JSON.stringify({ title: "Updated homework" }),
          headers: {
            "Accept-Language": "en-US",
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      ),
      { id: "homework-1" },
    );

    expect(response.status).toBe(200);
    expect(requireHomeworkItemByIdMock).toHaveBeenCalledWith({
      homeworkId: "homework-1",
      locale: "en-us",
      userId: "user-1",
    });
  });

  it("在解析 JSON 请求体前先认证作业更新", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());
    const { patchHomeworkRoute } = await import(
      "@/lib/api/routes/homework-mutation-routes"
    );

    const response = await patchHomeworkRoute(jsonRequest("PATCH", "{"), {
      id: "homework-1",
    });

    expect(response.status).toBe(401);
    expect(requireAuthMock).toHaveBeenCalledOnce();
  });

  it("在解析 JSON 请求体前先认证完成状态更新", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());
    const { putHomeworkCompletionRoute } = await import(
      "@/lib/api/routes/homework-completion"
    );

    const response = await putHomeworkCompletionRoute(jsonRequest("PUT", "{"), {
      id: "homework-1",
    });

    expect(response.status).toBe(401);
    expect(requireAuthMock).toHaveBeenCalledOnce();
    expect(setHomeworkCompletionsMock).not.toHaveBeenCalled();
  });

  it("在解析 JSON 请求体前先认证批量完成状态更新", async () => {
    requireAuthMock.mockResolvedValue(unauthorizedResponse());
    const { putHomeworkCompletionsRoute } = await import(
      "@/lib/api/routes/homework-completion"
    );

    const response = await putHomeworkCompletionsRoute(jsonRequest("PUT", "{"));

    expect(response.status).toBe(401);
    expect(requireAuthMock).toHaveBeenCalledOnce();
    expect(setHomeworkCompletionsMock).not.toHaveBeenCalled();
  });
});
