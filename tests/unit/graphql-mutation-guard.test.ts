import { afterEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { requireGraphqlMutation } from "@/lib/graphql/mutation-guard";
import type { GraphqlContext } from "@/lib/graphql/schema";

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
    "todo",
    "homework",
    "subscription",
    "dashboard",
    "bus",
    "comment",
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

  it("requires the exact OAuth write scope", async () => {
    await expect(
      requireGraphqlMutation(
        context({
          kind: "oauth",
          userId: "user-1",
          scopes: new Set(["todo:read"]),
          resource: "https://life.example/api/graphql",
        }),
        "todo",
      ),
    ).rejects.toMatchObject({
      extensions: {
        code: "FORBIDDEN",
        requiredScopes: ["todo:write"],
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
        "comment",
      ),
    ).rejects.toMatchObject({
      extensions: {
        code: "RATE_LIMITED",
        http: { status: 429 },
      },
    });
  });
});
