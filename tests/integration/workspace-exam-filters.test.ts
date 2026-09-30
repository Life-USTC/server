import { describe } from "vitest";
import { getSubscribedExamsRoute } from "@/lib/api/routes/subscribed-exam-routes";
import { workspaceExamTest as it } from "../shared/workspace-exam-fixture";

describe("complete subscribed exam pages", () => {
  it("exam.rest-date-semester-filters", async ({ exams, protocolRuntime, expect }) => {
    await protocolRuntime.run(async () => {
      const { users, semesterIds, examIds, signedRequest, read } = exams;
      const filtered = await read(users[0], {
        dateFrom: "2026-09-14T20:00:00Z",
        dateTo: "2026-09-15",
        includeDateUnknown: "false",
      });
      expect(filtered.data.map((exam) => exam.id)).toEqual([examIds[1]]);
      expect(filtered.pagination.total).toBe(1);
      const unknownIncluded = await read(users[0], {
        dateFrom: "2026-09-15",
        dateTo: "2026-09-15",
      });
      expect(unknownIncluded.data.map((exam) => exam.id)).toEqual([
        examIds[1],
        examIds[3],
      ]);
      expect(unknownIncluded.pagination.total).toBe(2);
      const semester = await read(users[0], {
        semesterId: String(semesterIds[1]),
        pageSize: "1",
      });
      expect(semester.pagination.total).toBe(2);
      expect(semester.data[0].id).toBe(examIds[2]);
      const otherPage = await read(users[0], {
        semesterId: String(semesterIds[1]),
        page: "2",
        pageSize: "1",
      });
      expect(otherPage.pagination.total).toBe(2);
      expect(otherPage.data.map((exam) => exam.id)).toEqual([examIds[3]]);
      const invalidInputs: Record<string, string>[] = [
        { dateFrom: "invalid" },
        { dateFrom: "2026-09-16", dateTo: "2026-09-15" },
        { includeDateUnknown: "invalid" },
        { pageSize: "101" },
      ];
      for (const input of invalidInputs) {
        const request = await signedRequest(0, "workspace.exam:read");
        const url = new URL(request.url);
        url.search = new URLSearchParams(input).toString();
        const response = await protocolRuntime.request(() =>
          getSubscribedExamsRoute(
            new Request(url, { headers: request.headers }),
          ),
        );
        expect(response.status).toBe(400);
        await response.text();
      }
    });
  });
});
