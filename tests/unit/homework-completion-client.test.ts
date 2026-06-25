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

describe("homework completion client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates completion through the shared route client", async () => {
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
    expect(path).toBe("/api/homeworks/homework-1/completion");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ completed: true });
  });

  it("uses API error payloads before fallback messages", async () => {
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

  it("falls back when error payloads are not JSON", async () => {
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

  it("rejects malformed successful payloads", async () => {
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
