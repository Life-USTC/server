import { afterEach, describe, expect, it, vi } from "vitest";
import { persistedGraphqlOperationDefinitions } from "@/lib/graphql/operation-definitions";
import { getRequiredMcpScopes } from "@/lib/mcp/tool-scopes";
import {
  getRequiredFeatureScope,
  restWriteScope,
} from "@/lib/oauth/scope-registry";

const expectedWriteScope = restWriteScope("community.section-homework");

const sectionHomeworkGraphqlMutationIds = [
  "community.section_homework.create.v1",
  "community.section_homework.update.v1",
  "community.section_homework.delete.v1",
] as const;

const sectionHomeworkMcpTools = [
  "community_section_homework_create",
  "community_section_homework_update",
  "community_section_homework_delete",
] as const;

const requireAuthMock = vi.fn();

vi.mock("@/lib/auth/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

describe("section homework write scope parity", () => {
  afterEach(() => {
    requireAuthMock.mockReset();
    vi.resetModules();
  });

  it.each(sectionHomeworkMcpTools)(
    "MCP %s requires community.section-homework:write",
    (tool) => {
      expect(getRequiredMcpScopes(tool)).toEqual([expectedWriteScope]);
    },
  );

  it.each(sectionHomeworkGraphqlMutationIds)(
    "GraphQL %s requires community.section-homework:write",
    (operationId) => {
      const operation = persistedGraphqlOperationDefinitions.find(
        (entry) => entry.id === operationId,
      );
      expect(operation?.scopes).toEqual([expectedWriteScope]);
    },
  );

  it("REST section-homework mutations require community.section-homework:write", async () => {
    requireAuthMock.mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { postHomeworkRoute } = await import(
      "@/lib/api/routes/homework-mutation-routes"
    );

    await postHomeworkRoute(
      new Request("https://example.test/api/community/section-homeworks", {
        body: "{}",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );

    expect(requireAuthMock).toHaveBeenCalledWith(expect.any(Request), {
      bearerScope: {
        feature: "community.section-homework",
        action: "write",
      },
    });
    expect(
      getRequiredFeatureScope({
        feature: "community.section-homework",
        action: "write",
      }),
    ).toBe(expectedWriteScope);
  });
});
