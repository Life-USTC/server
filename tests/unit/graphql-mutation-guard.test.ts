import { afterEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import type { GraphqlContext } from "@/lib/graphql/context";
import { requireGraphqlMutation } from "@/lib/graphql/mutation-guard";

function context(
  principal: GraphqlContext["principal"],
): Pick<GraphqlContext, "principal" | "request"> {
  return {
    principal,
    request: new Request("https://Life.Example/api/graphql"),
  };
}

afterEach(() => setCloudflareRuntimeEnv(undefined));

describe("GraphQL mutation guard", () => {
  it.each([
    "workspace.todo",
    "workspace.homework",
    "workspace.subscription",
    "workspace.link-pin",
    "workspace.bus-preferences",
    "community.comment",
    "community.description",
  ] as const)("shares the %s:write cross-protocol budget", async (feature) => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    setCloudflareRuntimeEnv({ USER_WRITE_RATE_LIMITER: { limit } });

    await expect(
      requireGraphqlMutation(
        context({ kind: "session", userId: "user-1" }),
        feature,
      ),
    ).resolves.toMatchObject({ userId: "user-1" });

    expect(JSON.parse(limit.mock.calls[0][0].key)).toEqual([
      "user-mutation:v1",
      "life.example",
      `${feature}:write`,
      "user-1",
    ]);
  });

  it("uses the stricter shared batch budget without changing OAuth scope", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    setCloudflareRuntimeEnv({ USER_BATCH_WRITE_RATE_LIMITER: { limit } });

    await expect(
      requireGraphqlMutation(
        context({
          kind: "oauth",
          userId: "user-1",
          scopes: new Set(["workspace.todo:write"]),
          resource: "https://life.example/api/graphql",
        }),
        "workspace.todo",
        { rateLimitTier: "batch" },
      ),
    ).resolves.toMatchObject({ userId: "user-1" });

    expect(JSON.parse(limit.mock.calls[0][0].key)).toEqual([
      "user-mutation:v1",
      "life.example",
      "workspace.todo:batch-write",
      "user-1",
    ]);
  });

  it.each([
    "workspace.todo",
    "community.description",
  ] as const)("requires the exact OAuth %s write scope", async (feature) => {
    await expect(
      requireGraphqlMutation(
        context({
          kind: "oauth",
          userId: "user-1",
          scopes: new Set([`${feature}:read`]),
          resource: "https://life.example/api/graphql",
        }),
        feature,
      ),
    ).rejects.toMatchObject({
      extensions: {
        code: "FORBIDDEN",
        requiredScopes: [`${feature}:write`],
      },
    });
  });

  it("returns a safe rate-limit error without calling the resolver service", async () => {
    setCloudflareRuntimeEnv({
      USER_WRITE_RATE_LIMITER: {
        limit: vi.fn().mockResolvedValue({ success: false }),
      },
    });

    await expect(
      requireGraphqlMutation(
        context({ kind: "session", userId: "user-1" }),
        "community.comment",
      ),
    ).rejects.toMatchObject({
      extensions: {
        code: "RATE_LIMITED",
        http: { status: 429 },
      },
    });
  });
});
