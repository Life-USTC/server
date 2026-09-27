import { beforeEach, expect, it, vi } from "vitest";
import type { GraphqlContext } from "@/lib/graphql/context";
import { homeworkExpectation } from "../../../shared/specifications/homework";

const { writeBatch, requireAuth, requireGraphqlMutation } = vi.hoisted(() => ({
  writeBatch: vi.fn(),
  requireAuth: vi.fn(),
  requireGraphqlMutation: vi.fn(),
}));
vi.mock("@/features/homeworks/server/homework-completion", () => ({
  setHomeworkCompletions: writeBatch,
  setHomeworkCompletion: vi.fn(),
}));
vi.mock("@/lib/auth/api-auth", () => ({ requireAuth }));
vi.mock("@/lib/graphql/mutation-guard", () => ({ requireGraphqlMutation }));

import { putHomeworkCompletionsRoute } from "@/lib/api/routes/homework-completion";
import { homeworkMutationResolvers } from "@/lib/graphql/mutations/homeworks";

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue({ userId: "owner" });
  requireGraphqlMutation.mockResolvedValue({ userId: "owner" });
  writeBatch.mockResolvedValue({ results: [] });
});

function items(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    homeworkId: `hw-${index}`,
    completed: true,
  }));
}

it("enforces the specified REST completion batch boundaries", async () => {
  const specification = homeworkExpectation(
    "homework.rest-completion-batch-input",
    "collection_input",
  );
  const [method, path] = specification.operation.split(" ");
  const send = (value: ReturnType<typeof items>) =>
    putHomeworkCompletionsRoute(
      new Request(`https://example.test${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [specification.input]: value }),
      }),
    );
  for (const count of [specification.min_items, specification.max_items]) {
    writeBatch.mockClear();
    expect((await send(items(count))).status).toBe(200);
    expect(writeBatch).toHaveBeenCalledWith({
      items: items(count),
      userId: "owner",
    });
  }
  for (const count of [
    specification.min_items - 1,
    specification.max_items + 1,
  ]) {
    writeBatch.mockClear();
    expect((await send(items(count))).status).toBe(400);
    expect(writeBatch).not.toHaveBeenCalled();
  }
  writeBatch.mockClear();
  const duplicates = [items(1)[0], items(1)[0]];
  expect((await send(duplicates)).status).toBe(
    specification.unique_items ? 400 : 200,
  );
  expect(writeBatch).toHaveBeenCalledTimes(specification.unique_items ? 0 : 1);
});

it("enforces the specified GRAPHQL completion batch boundaries", async () => {
  const specification = homeworkExpectation(
    "homework.graphql-completion-batch-input",
    "collection_input",
  );
  const resolvers = {
    homeworkCompletionsSet: homeworkMutationResolvers.homeworkCompletionsSet,
  };
  const resolver = resolvers[specification.operation as keyof typeof resolvers];
  const send = (value: ReturnType<typeof items>) =>
    resolver(null, { [specification.input]: value }, {} as GraphqlContext);
  for (const count of [specification.min_items, specification.max_items]) {
    writeBatch.mockClear();
    await expect(send(items(count))).resolves.toEqual({ results: [] });
    expect(writeBatch).toHaveBeenCalledWith({
      items: items(count),
      userId: "owner",
    });
  }
  for (const count of [
    specification.min_items - 1,
    specification.max_items + 1,
  ]) {
    writeBatch.mockClear();
    await expect(send(items(count))).rejects.toMatchObject({
      extensions: { code: "BAD_USER_INPUT" },
    });
    expect(writeBatch).not.toHaveBeenCalled();
  }
  writeBatch.mockClear();
  const result = send([items(1)[0], items(1)[0]]);
  if (specification.unique_items)
    await expect(result).rejects.toMatchObject({
      extensions: { code: "BAD_USER_INPUT" },
    });
  else await expect(result).resolves.toEqual({ results: [] });
  expect(writeBatch).toHaveBeenCalledTimes(specification.unique_items ? 0 : 1);
});
