import { afterEach, describe, expect, it, vi } from "vitest";

const { requireAuthMock, requireWriteAuthMock, setHomeworkCompletionsMock } =
  vi.hoisted(() => ({
    requireAuthMock: vi.fn(),
    requireWriteAuthMock: vi.fn(),
    setHomeworkCompletionsMock: vi.fn(),
  }));

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
  requireWriteAuth: requireWriteAuthMock,
}));

vi.mock("@/features/homeworks/server/homework-create", () => ({
  createHomeworkForSection: vi.fn(),
}));

vi.mock("@/features/homeworks/server/homework-read-model", () => ({
  requireHomeworkItemById: vi.fn(),
}));

vi.mock("@/features/homeworks/server/homework-mutations", () => ({
  deleteHomework: vi.fn(),
  updateHomework: vi.fn(),
}));

vi.mock("@/features/homeworks/server/homework-completion", () => ({
  setHomeworkCompletions: setHomeworkCompletionsMock,
}));

function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function jsonRequest(method: string, body: string) {
  return new Request("https://example.test/api/homeworks", {
    body,
    headers: { "Content-Type": "application/json" },
    method,
  });
}

describe("homework mutation route auth order", () => {
  afterEach(() => {
    requireAuthMock.mockReset();
    requireWriteAuthMock.mockReset();
    setHomeworkCompletionsMock.mockReset();
    vi.resetModules();
  });

  it("authenticates homework creation before parsing the JSON body", async () => {
    requireWriteAuthMock.mockResolvedValue(unauthorizedResponse());
    const { postHomeworkRoute } = await import(
      "@/lib/api/routes/homework-mutation-routes"
    );

    const response = await postHomeworkRoute(jsonRequest("POST", "{"));

    expect(response.status).toBe(401);
    expect(requireWriteAuthMock).toHaveBeenCalledOnce();
  });

  it("authenticates homework updates before parsing the JSON body", async () => {
    requireWriteAuthMock.mockResolvedValue(unauthorizedResponse());
    const { patchHomeworkRoute } = await import(
      "@/lib/api/routes/homework-mutation-routes"
    );

    const response = await patchHomeworkRoute(jsonRequest("PATCH", "{"), {
      id: "homework-1",
    });

    expect(response.status).toBe(401);
    expect(requireWriteAuthMock).toHaveBeenCalledOnce();
  });

  it("authenticates completion updates before parsing the JSON body", async () => {
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

  it("authenticates completion batches before parsing the JSON body", async () => {
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
