import { afterEach, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import type { GraphqlContext } from "@/lib/graphql/context";

const calls = vi.hoisted(() => ({
  todoSet: vi.fn(),
  todoDelete: vi.fn(),
  homeworkSet: vi.fn(),
  commentDelete: vi.fn(),
  resolveLink: vi.fn(),
  updatePin: vi.fn(),
}));
vi.mock("@/features/todos/server/todo-batch-service", () => ({
  setTodoCompletionsBatch: calls.todoSet,
  deleteTodosBatch: calls.todoDelete,
}));
vi.mock("@/features/homeworks/server/homework-completion", () => ({
  setHomeworkCompletion: vi.fn(),
  setHomeworkCompletions: calls.homeworkSet,
}));
vi.mock("@/features/comments/server/comment-batch-delete", () => ({
  deleteOwnCommentsBatch: calls.commentDelete,
}));
vi.mock("@/features/catalog-links/server/catalog-link-service", () => ({
  MAX_PINNED_LINKS: 4,
  resolveCatalogLinkBySlug: calls.resolveLink,
  updateWorkspaceLinkPinState: calls.updatePin,
}));

import { commentMutationResolvers } from "@/lib/graphql/mutations/comments";
import { homeworkMutationResolvers } from "@/lib/graphql/mutations/homeworks";
import { linkMutationResolvers } from "@/lib/graphql/mutations/links";
import { todoMutationResolvers } from "@/lib/graphql/mutations/todos";

const context = {
  principal: { kind: "session", userId: "batch-owner" },
  locale: "en-us",
  request: new Request("https://life.example/api/graphql"),
} as GraphqlContext;
function allowWrites() {
  setCloudflareRuntimeEnv({
    USER_BATCH_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
  });
}
afterEach(() => {
  setCloudflareRuntimeEnv(undefined);
  vi.resetAllMocks();
});

it("graphql.batch-unique-ids", async () => {
  allowWrites();
  for (const ids of [
    ["same", "same"],
    ["same", " same "],
  ]) {
    for (const call of [
      () =>
        todoMutationResolvers.todoCompletionsSet(
          null,
          { items: ids.map((todoId) => ({ todoId, completed: true })) },
          context,
        ),
      () => todoMutationResolvers.todosDelete(null, { ids }, context),
      () =>
        homeworkMutationResolvers.homeworkCompletionsSet(
          null,
          { items: ids.map((homeworkId) => ({ homeworkId, completed: true })) },
          context,
        ),
      () => commentMutationResolvers.commentsDelete(null, { ids }, context),
    ])
      await expect(call()).rejects.toMatchObject({
        extensions: { code: "BAD_USER_INPUT" },
      });
  }
  for (const service of [
    calls.todoSet,
    calls.todoDelete,
    calls.homeworkSet,
    calls.commentDelete,
  ])
    expect(service).not.toHaveBeenCalled();
});

it("graphql.pin-batch-failure", async () => {
  allowWrites();
  const effects: string[] = [];
  calls.resolveLink.mockImplementation((slug: string) =>
    slug === "missing" ? null : { slug },
  );
  calls.updatePin.mockImplementation(async ({ slug }: { slug: string }) => {
    effects.push(slug);
    return [...effects];
  });
  await expect(
    linkMutationResolvers.linkPinsSet(
      null,
      {
        items: [
          { slug: " mail ", pinned: true },
          { slug: "missing", pinned: true },
        ],
      },
      context,
    ),
  ).rejects.toMatchObject({ extensions: { code: "BAD_USER_INPUT" } });
  expect(calls.updatePin).not.toHaveBeenCalled();
  let attempt = 0;
  calls.updatePin.mockImplementation(async ({ slug }: { slug: string }) => {
    attempt++;
    if (attempt === 2) throw new Error("second write failed");
    effects.push(slug);
    return [...effects];
  });
  const items = [
    { slug: "mail", pinned: true },
    { slug: "portal", pinned: true },
  ];
  await expect(
    linkMutationResolvers.linkPinsSet(null, { items }, context),
  ).rejects.toThrow("second write failed");
  expect(effects).toEqual(["mail"]);
  expect(calls.updatePin).toHaveBeenNthCalledWith(1, {
    action: "pin",
    slug: "mail",
    userId: "batch-owner",
  });
  expect(calls.updatePin).toHaveBeenNthCalledWith(2, {
    action: "pin",
    slug: "portal",
    userId: "batch-owner",
  });
  // The adapter has no transaction/retry guarantee: retry invokes the earlier
  // successful operation again, so callers cannot infer rollback from failure.
  await expect(
    linkMutationResolvers.linkPinsSet(null, { items }, context),
  ).resolves.toMatchObject({ pinnedSlugs: ["mail", "mail", "portal"] });
  expect(effects).toEqual(["mail", "mail", "portal"]);
});
