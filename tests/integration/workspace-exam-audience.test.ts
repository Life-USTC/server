import { describe } from "vitest";
import { getSubscribedExamsRoute } from "@/lib/api/routes/subscribed-exam-routes";
import { getOAuthGraphqlResourceUrl } from "@/lib/mcp/urls";
import { workspaceExamTest as it } from "../shared/workspace-exam-fixture";

describe("complete subscribed exam pages", () => {
  it("rejects a correctly signed exam-read token issued for GraphQL without returning data", {
    tags: ["@Exam/REST"],
  }, async ({ exams, protocolRuntime, expect }) => {
    await protocolRuntime.run(async () => {
      const { signedRequest } = exams;
      const response = await protocolRuntime.request(async () =>
        getSubscribedExamsRoute(
          await signedRequest(
            0,
            "workspace.exam:read",
            getOAuthGraphqlResourceUrl(),
          ),
        ),
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    });
  });
});
