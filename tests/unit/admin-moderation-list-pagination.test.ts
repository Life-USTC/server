import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  commentCountMock,
  commentFindManyMock,
  descriptionCountMock,
  descriptionFindManyMock,
  homeworkCountMock,
  homeworkFindManyMock,
} = vi.hoisted(() => ({
  commentCountMock: vi.fn(),
  commentFindManyMock: vi.fn(),
  descriptionCountMock: vi.fn(),
  descriptionFindManyMock: vi.fn(),
  homeworkCountMock: vi.fn(),
  homeworkFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    comment: { count: commentCountMock, findMany: commentFindManyMock },
    description: {
      count: descriptionCountMock,
      findMany: descriptionFindManyMock,
    },
    homework: { count: homeworkCountMock, findMany: homeworkFindManyMock },
  },
}));

import {
  listAdminModerationComments,
  listAdminModerationDescriptions,
  listAdminModerationHomeworks,
} from "@/features/admin/server/admin-moderation-api-lists";

describe("admin moderation list pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    commentFindManyMock.mockResolvedValue([{ id: "comment-2" }]);
    commentCountMock.mockResolvedValue(5);
    descriptionFindManyMock.mockResolvedValue([{ id: "description-2" }]);
    descriptionCountMock.mockResolvedValue(6);
    homeworkFindManyMock.mockResolvedValue([{ id: "homework-2" }]);
    homeworkCountMock.mockResolvedValue(7);
  });

  it("applies skip/take and returns a matching total for comments", async () => {
    await expect(
      listAdminModerationComments({ pageSize: 2, skip: 2, status: "active" }),
    ).resolves.toEqual({ data: [{ id: "comment-2" }], total: 5 });

    expect(commentFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 2, take: 2 }),
    );
    expect(commentCountMock).toHaveBeenCalledWith({
      where: commentFindManyMock.mock.calls[0]?.[0]?.where,
    });
  });

  it("applies skip/take and returns a matching total for descriptions", async () => {
    await expect(
      listAdminModerationDescriptions({
        hasContent: "withContent",
        pageSize: 3,
        search: "course",
        skip: 3,
        targetType: "section",
      }),
    ).resolves.toEqual({ data: [{ id: "description-2" }], total: 6 });

    expect(descriptionFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 3, take: 3 }),
    );
    expect(descriptionCountMock).toHaveBeenCalledWith({
      where: descriptionFindManyMock.mock.calls[0]?.[0]?.where,
    });
  });

  it("applies skip/take and returns a matching total for homeworks", async () => {
    await expect(
      listAdminModerationHomeworks({
        pageSize: 1,
        search: "homework",
        skip: 4,
        status: "deleted",
      }),
    ).resolves.toEqual({ data: [{ id: "homework-2" }], total: 7 });

    expect(homeworkFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 4, take: 1 }),
    );
    expect(homeworkCountMock).toHaveBeenCalledWith({
      where: homeworkFindManyMock.mock.calls[0]?.[0]?.where,
    });
  });
});
