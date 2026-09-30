import { describe } from "vitest";
import { getSubscribedExamsRoute } from "@/lib/api/routes/subscribed-exam-routes";
import { getMyCompactOverviewRoute } from "@/lib/api/routes/workspace-overview-route";
import { workspaceExamTest as it } from "../shared/workspace-exam-fixture";

describe("complete subscribed exam pages", () => {
  it("exam.rest-read-scope", async ({ exams, protocolRuntime, expect }) => {
    await protocolRuntime.run(async () => {
      const { signedRequest } = exams;
      const request = await signedRequest(0, "workspace.overview:read");
      // The same JWT succeeds on its authorized feature, proving the denial is
      // the exam scope boundary rather than a broken signer or consent fixture.
      const overviewResponse = await protocolRuntime.request(() =>
        getMyCompactOverviewRoute(
          new Request("https://example.test/api/workspace/overview", {
            headers: request.headers,
          }),
        ),
      );
      expect(overviewResponse.status).toBe(200);
      await overviewResponse.text();
      const response = await protocolRuntime.request(async () =>
        getSubscribedExamsRoute(request),
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    });
  });
});
