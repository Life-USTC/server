import { beforeEach, describe, expect, it, vi } from "vitest";

const services = vi.hoisted(() => ({
  findCoursesByJwIds: vi.fn(),
  findSectionsByJwIds: vi.fn(),
  findTeachersByIds: vi.fn(),
}));

vi.mock("@/features/catalog/server/course-section-read-queries", () => ({
  findCoursesByJwIds: services.findCoursesByJwIds,
  findSectionsByJwIds: services.findSectionsByJwIds,
}));
vi.mock("@/features/catalog/server/teacher-summary-read-model", () => ({
  findTeachersByIds: services.findTeachersByIds,
}));

import { createGraphqlLoaders } from "@/lib/graphql/loaders";

describe("GraphQL request-scoped loaders", () => {
  beforeEach(() => {
    services.findCoursesByJwIds.mockReset();
    services.findSectionsByJwIds.mockReset();
    services.findTeachersByIds.mockReset();
    services.findCoursesByJwIds.mockImplementation(
      async (ids: readonly number[]) => ids.map((jwId) => ({ jwId })),
    );
  });

  it("batches and caches within one request, then starts fresh next request", async () => {
    const firstRequest = createGraphqlLoaders("zh-cn");

    await expect(
      Promise.all([
        firstRequest.courseByJwId.load(101),
        firstRequest.courseByJwId.load(102),
        firstRequest.courseByJwId.load(101),
      ]),
    ).resolves.toEqual([{ jwId: 101 }, { jwId: 102 }, { jwId: 101 }]);
    expect(services.findCoursesByJwIds).toHaveBeenCalledTimes(1);
    expect(services.findCoursesByJwIds).toHaveBeenCalledWith(
      [101, 102],
      "zh-cn",
    );

    const nextRequest = createGraphqlLoaders("zh-cn");
    await nextRequest.courseByJwId.load(101);

    expect(services.findCoursesByJwIds).toHaveBeenCalledTimes(2);
  });
});
