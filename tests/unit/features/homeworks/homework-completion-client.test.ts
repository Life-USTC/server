import { afterEach, describe, expect, it, vi } from "vitest";
import { updateHomeworkCompletion } from "@/features/homeworks/lib/homework-completion-client";

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

function firstFetchCall(fetchMock: ReturnType<typeof vi.fn>) {
  const call = fetchMock.mock.calls[0];
  expect(call).toBeDefined();
  return call as unknown as [string, RequestInit & { body: string }];
}

describe("作业完成状态客户端", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("通过共享路由客户端更新完成状态", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        completed: true,
        completedAt: "2026-06-22T10:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateHomeworkCompletion({
        completed: true,
        fallbackMessage: "completion failed",
        homeworkId: "homework-1",
      }),
    ).resolves.toEqual({
      completed: true,
      completedAt: "2026-06-22T10:00:00.000Z",
    });

    const [path, init] = firstFetchCall(fetchMock);
    expect(path).toBe("/api/workspace/homeworks/homework-1/completion");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ completed: true });
  });

  it("优先使用 API 错误负载而非回退消息", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: "  homework not found  " }, { status: 404 }),
      ),
    );

    await expect(
      updateHomeworkCompletion({
        completed: false,
        fallbackMessage: "completion failed",
        homeworkId: "missing",
      }),
    ).rejects.toThrow("homework not found");
  });

  it("当错误负载不是 JSON 时使用回退消息", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("plain failure", { status: 500 })),
    );

    await expect(
      updateHomeworkCompletion({
        completed: false,
        fallbackMessage: "completion failed",
        homeworkId: "homework-1",
      }),
    ).rejects.toThrow("completion failed");
  });

  it("拒绝格式错误的成功响应负载", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ completed: true })),
    );

    await expect(
      updateHomeworkCompletion({
        completed: true,
        fallbackMessage: "completion failed",
        homeworkId: "homework-1",
      }),
    ).rejects.toThrow("completion failed");
  });
});
