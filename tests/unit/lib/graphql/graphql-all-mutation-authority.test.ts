import { afterEach, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import type { GraphqlContext } from "@/lib/graphql/context";
import { graphqlMutationResolvers } from "@/lib/graphql/mutations";
import { graphqlPersistedOperationRegistry } from "@/lib/graphql/operations";
import { graphqlSchema } from "@/lib/graphql/schema";
import { youngWorkspaceMutationResolvers } from "@/lib/graphql/young-workspace";

afterEach(() => setCloudflareRuntimeEnv(undefined));

it("graphql.scoped-mutations", async () => {
  const resolvers = {
    ...graphqlMutationResolvers.Mutation,
    ...youngWorkspaceMutationResolvers,
  };
  expect(Object.keys(resolvers).sort()).toEqual(
    Object.keys(graphqlSchema.getMutationType()?.getFields() ?? {}).sort(),
  );
  for (const [field, resolver] of Object.entries(resolvers)) {
    const operation = graphqlPersistedOperationRegistry.find(
      (item) => item.operationType === "mutation" && item.rootField === field,
    );
    if (!operation) throw new Error(`Missing registered mutation ${field}`);
    expect(operation.scopes, field).toHaveLength(1);
    const scope = operation.scopes[0];
    expect(scope, field).toMatch(/:write$/);
    const feature = scope.replace(/:write$/, "");
    const limit = vi.fn().mockResolvedValue({ success: false });
    setCloudflareRuntimeEnv({
      USER_WRITE_RATE_LIMITER: { limit },
      USER_BATCH_WRITE_RATE_LIMITER: { limit },
    });
    const call = (principal: GraphqlContext["principal"]) =>
      Promise.resolve().then(() =>
        (
          resolver as (
            parent: unknown,
            args: Record<string, unknown>,
            context: GraphqlContext,
          ) => unknown
        )(null, {}, {
          locale: "zh-cn",
          principal,
          request: new Request("https://Life.Example/api/graphql"),
        } as GraphqlContext),
      );
    await expect(call({ kind: "anonymous" }), field).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    await expect(
      call({
        kind: "oauth",
        userId: "mutation-user",
        clientId: "mutation-client",
        resource: "https://life.example/api/graphql",
        scopes: new Set([`${feature}:read`]),
      }),
      field,
    ).rejects.toMatchObject({ extensions: { code: "FORBIDDEN" } });
    expect(limit, field).not.toHaveBeenCalled();
    for (const principal of [
      { kind: "session", userId: "mutation-user" },
      {
        kind: "oauth",
        userId: "mutation-user",
        clientId: "mutation-client",
        resource: "https://life.example/api/graphql",
        scopes: new Set([scope]),
      },
    ] satisfies GraphqlContext["principal"][]) {
      limit.mockClear();
      await expect(call(principal), field).rejects.toMatchObject({
        extensions: { code: "RATE_LIMITED" },
      });
      expect(limit, field).toHaveBeenCalledOnce();
      const batch = [
        "todoCompletionsSet",
        "todosDelete",
        "homeworkCompletionsSet",
        "subscriptionsImport",
        "linkPinsSet",
        "commentsDelete",
      ].includes(field);
      expect(JSON.parse(limit.mock.calls[0][0].key), field).toEqual([
        "user-mutation:v1",
        "life.example",
        `${feature}:${batch ? "batch-write" : "write"}`,
        "mutation-user",
      ]);
    }
  }
});
