import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphqlContext } from "@/lib/graphql/context";
import { graphqlMutationResolvers } from "@/lib/graphql/mutations";

const {
  createHomeworkForSectionMock,
  deleteHomeworkMock,
  requireGraphqlMutationMock,
  requireHomeworkItemByIdMock,
  updateHomeworkMock,
} = vi.hoisted(() => ({
  createHomeworkForSectionMock: vi.fn(),
  deleteHomeworkMock: vi.fn(),
  requireGraphqlMutationMock: vi.fn(),
  requireHomeworkItemByIdMock: vi.fn(),
  updateHomeworkMock: vi.fn(),
}));

vi.mock("@/features/homeworks/server/homework-create", () => ({
  createHomeworkForSection: createHomeworkForSectionMock,
}));

vi.mock("@/features/homeworks/server/homework-mutations", () => ({
  deleteHomework: deleteHomeworkMock,
  updateHomework: updateHomeworkMock,
}));

vi.mock("@/features/homeworks/server/homework-read-model", () => ({
  requireHomeworkItemById: requireHomeworkItemByIdMock,
}));

vi.mock("@/lib/graphql/mutation-guard", () => ({
  requireGraphqlMutation: requireGraphqlMutationMock,
}));

const context = {
  locale: "en-us",
  principal: { kind: "anonymous" },
  request: new Request("https://life.example/api/graphql"),
} as unknown as GraphqlContext;

describe("GraphQL homework mutation resolvers", () => {
  beforeEach(() => {
    createHomeworkForSectionMock.mockReset();
    deleteHomeworkMock.mockReset();
    requireGraphqlMutationMock.mockReset();
    requireHomeworkItemByIdMock.mockReset();
    updateHomeworkMock.mockReset();
    requireGraphqlMutationMock.mockResolvedValue({ userId: "user-1" });
  });

  it("creates through the shared service and returns the localized snapshot", async () => {
    createHomeworkForSectionMock.mockResolvedValue({
      ok: true,
      homework: { id: "homework-1" },
    });
    const homework = { id: "homework-1", title: "第 1 次作业" };
    requireHomeworkItemByIdMock.mockResolvedValue(homework);

    const result = await graphqlMutationResolvers.Mutation.createHomework(
      null,
      {
        input: {
          description: "  第一题  ",
          isMajor: true,
          publishedAt: "2026-07-20T08:00:00+08:00",
          requiresTeam: false,
          sectionJwId: 1234,
          submissionDueAt: "2026-07-22T18:00:00+08:00",
          submissionStartAt: "2026-07-21T08:00:00+08:00",
          title: "  第 1 次作业  ",
        },
      },
      context,
    );

    expect(requireGraphqlMutationMock).toHaveBeenCalledWith(
      context,
      "homework",
    );
    expect(createHomeworkForSectionMock).toHaveBeenCalledWith("user-1", {
      description: "第一题",
      isMajor: true,
      publishedAt: new Date("2026-07-20T00:00:00.000Z"),
      requiresTeam: false,
      sectionJwId: 1234,
      submissionDueAt: new Date("2026-07-22T10:00:00.000Z"),
      submissionStartAt: new Date("2026-07-21T00:00:00.000Z"),
      title: "第 1 次作业",
    });
    expect(requireHomeworkItemByIdMock).toHaveBeenCalledWith({
      homeworkId: "homework-1",
      locale: "en-us",
      userId: "user-1",
    });
    expect(result).toEqual({ id: "homework-1", homework });
  });

  it("updates through the shared intent and preserves nullable clear fields", async () => {
    updateHomeworkMock.mockResolvedValue({ ok: true });
    const homework = { id: "homework-1", title: "Updated" };
    requireHomeworkItemByIdMock.mockResolvedValue(homework);

    const result = await graphqlMutationResolvers.Mutation.updateHomework(
      null,
      {
        id: " homework-1 ",
        input: {
          description: null,
          isMajor: false,
          publishedAt: null,
          submissionDueAt: "2026-07-23T18:00:00+08:00",
          title: "  Updated  ",
        },
      },
      context,
    );

    expect(updateHomeworkMock).toHaveBeenCalledWith({
      homeworkId: "homework-1",
      update: {
        description: null,
        homeworkUpdates: {
          isMajor: false,
          publishedAt: null,
          submissionDueAt: new Date("2026-07-23T10:00:00.000Z"),
          title: "Updated",
          updatedBy: { connect: { id: "user-1" } },
        },
      },
      userId: "user-1",
    });
    expect(requireHomeworkItemByIdMock).toHaveBeenCalledWith({
      homeworkId: "homework-1",
      locale: "en-us",
      userId: "user-1",
    });
    expect(result).toEqual({ id: "homework-1", homework });
  });

  it("preserves idempotent delete semantics from the shared service", async () => {
    deleteHomeworkMock.mockResolvedValue({
      ok: true,
      alreadyDeleted: true,
    });

    await expect(
      graphqlMutationResolvers.Mutation.deleteHomework(
        null,
        { id: " homework-1 " },
        context,
      ),
    ).resolves.toEqual({
      id: "homework-1",
      success: true,
      alreadyDeleted: true,
    });
    expect(deleteHomeworkMock).toHaveBeenCalledWith({
      homeworkId: "homework-1",
      userId: "user-1",
    });
  });

  it.each([
    {
      error: "not_found",
      expectedCode: "NOT_FOUND",
      expectedMessage: "Section not found.",
      mutation: "create",
    },
    {
      error: "deleted",
      expectedCode: "FORBIDDEN",
      expectedMessage: "Homework is deleted.",
      mutation: "update",
    },
    {
      error: "suspended",
      expectedCode: "FORBIDDEN",
      expectedMessage: "Homework writes are suspended.",
      mutation: "delete",
    },
  ])("maps $mutation service error $error to $expectedCode", async ({
    error,
    expectedCode,
    expectedMessage,
    mutation,
  }) => {
    let promise: Promise<unknown>;
    if (mutation === "create") {
      createHomeworkForSectionMock.mockResolvedValue({ ok: false, error });
      promise = graphqlMutationResolvers.Mutation.createHomework(
        null,
        {
          input: {
            isMajor: false,
            requiresTeam: false,
            sectionJwId: 1234,
            title: "Homework",
          },
        },
        context,
      );
    } else if (mutation === "update") {
      updateHomeworkMock.mockResolvedValue({ ok: false, error });
      promise = graphqlMutationResolvers.Mutation.updateHomework(
        null,
        { id: "homework-1", input: { title: "Updated" } },
        context,
      );
    } else {
      deleteHomeworkMock.mockResolvedValue({ ok: false, error });
      promise = graphqlMutationResolvers.Mutation.deleteHomework(
        null,
        { id: "homework-1" },
        context,
      );
    }

    await expect(promise).rejects.toMatchObject({
      extensions: { code: expectedCode },
      message: expectedMessage,
    });
  });
});
