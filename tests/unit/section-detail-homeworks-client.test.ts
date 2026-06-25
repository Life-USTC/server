import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type SectionHomeworkRequest,
  updateSectionHomework,
} from "@/features/section-detail/lib/homeworks";

const homeworkInput: SectionHomeworkRequest = {
  description: "Updated description",
  isMajor: true,
  publishedAt: "2026-06-22T08:00:00.000Z",
  requiresTeam: false,
  submissionDueAt: "2026-06-29T08:00:00.000Z",
  submissionStartAt: null,
  title: "Updated homework",
};

describe("section detail homeworks client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates homework and description through one homework PATCH", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateSectionHomework("homework-1", homeworkInput),
    ).resolves.toBe("ok");

    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const [path, init] = call as unknown as [
      string,
      RequestInit & { body: string },
    ];
    expect(path).toBe("/api/homeworks/homework-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      title: "Updated homework",
      description: "Updated description",
      publishedAt: "2026-06-22T08:00:00.000Z",
      submissionStartAt: null,
      submissionDueAt: "2026-06-29T08:00:00.000Z",
      isMajor: true,
      requiresTeam: false,
    });
  });

  it("maps failed homework PATCH requests to one update failure", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateSectionHomework("homework-1", homeworkInput),
    ).resolves.toBe("homework-error");

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
