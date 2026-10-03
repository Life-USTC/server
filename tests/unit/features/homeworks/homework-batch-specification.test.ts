import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphqlContext } from "@/lib/graphql/context";

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

const invalidBatches = [
  { name: "empty", value: [] },
  { name: "over 100 items", value: items(101) },
  { name: "duplicate targets", value: [items(1)[0], items(1)[0]] },
  {
    name: "duplicate normalized targets",
    value: [items(1)[0], { homeworkId: " hw-0 ", completed: false }],
  },
];

describe("REST homework completion batch boundaries", () => {
  const send = (value: ReturnType<typeof items>) =>
    putHomeworkCompletionsRoute(
      new Request("https://example.test/api/workspace/homeworks/completions", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: value }),
      }),
    );
  it.each([1, 100])("accepts %s items", async (count) => {
    expect((await send(items(count))).status).toBe(200);
    expect(writeBatch).toHaveBeenCalledExactlyOnceWith({
      items: items(count),
      userId: "owner",
    });
  });
  it.each(invalidBatches)("rejects $name without writes", async ({ value }) => {
    expect((await send(structuredClone(value))).status).toBe(400);
    expect(writeBatch).not.toHaveBeenCalled();
  });
});

describe("GraphQL homework completion batch boundaries", () => {
  const send = (value: ReturnType<typeof items>) =>
    homeworkMutationResolvers.homeworkCompletionsSet(
      null,
      { items: value },
      {} as GraphqlContext,
    );
  it.each([1, 100])("accepts %s items", async (count) => {
    await expect(send(items(count))).resolves.toEqual({ results: [] });
    expect(writeBatch).toHaveBeenCalledExactlyOnceWith({
      items: items(count),
      userId: "owner",
    });
  });
  it.each(invalidBatches)("rejects $name without writes", async ({ value }) => {
    await expect(send(structuredClone(value))).rejects.toMatchObject({
      extensions: { code: "BAD_USER_INPUT" },
    });
    expect(writeBatch).not.toHaveBeenCalled();
  });
});
