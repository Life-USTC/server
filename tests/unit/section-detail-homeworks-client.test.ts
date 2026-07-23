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

describe("课程详情作业客户端", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("通过一次作业 PATCH 更新作业和描述", async () => {
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
    expect(path).toBe("/api/community/section-homeworks/homework-1");
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

  it("将失败的作业 PATCH 请求映射为一次更新失败", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateSectionHomework("homework-1", homeworkInput),
    ).resolves.toBe("homework-error");

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
