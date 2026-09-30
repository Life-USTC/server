import { describe } from "vitest";
import { getSubscribedExamsRoute } from "@/lib/api/routes/subscribed-exam-routes";
import { subscribedExamsResponseSchema } from "@/lib/api/schemas/subscribed-exams-schemas";
import { workspaceExamTest as it } from "../shared/workspace-exam-fixture";

describe("complete subscribed exam pages", () => {
  it("accepts real signed exam-read tokens and returns only their subject's subscribed exams", async ({ exams, protocolRuntime, expect }) => {
    await protocolRuntime.run(async () => {
      const { examIds, signedRequest } = exams;
      for (const userIndex of [0, 1]) {
        const response = await protocolRuntime.request(async () => getSubscribedExamsRoute(
          await signedRequest(userIndex, "workspace.exam:read"),
        ));
        expect(response.status).toBe(200);
        const result = subscribedExamsResponseSchema.parse(await response.json());
        expect(result.data.map((exam) => exam.id)).toEqual(
          userIndex === 0 ? examIds.slice(0, 4) : [examIds[4]],
        );
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      }
    });
  });
});
