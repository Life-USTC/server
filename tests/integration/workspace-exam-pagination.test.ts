import { describe } from "vitest";
import { workspaceExamTest as it } from "../shared/workspace-exam-fixture";

describe("complete subscribed exam pages", () => {
  it("exam.owned-page-completeness", { tags: ["@Exam/REST"] }, async ({
    exams,
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const { users, examIds, read } = exams;
      const first = await read(users[0], { pageSize: "2" });
      const second = await read(users[0], { page: "2", pageSize: "2" });
      expect(first.pagination).toEqual({
        page: 1,
        pageSize: 2,
        total: 4,
        totalPages: 2,
      });
      expect(second.pagination).toEqual({
        page: 2,
        pageSize: 2,
        total: 4,
        totalPages: 2,
      });
      expect([...first.data, ...second.data].map((exam) => exam.id)).toEqual(
        examIds.slice(0, 4),
      );
      expect(second.data[1].examDate).toBeNull();
      expect(second.data[1].section.semester?.nameCn).toBe("Semester 1");
      expect((await read(users[1])).data.map((exam) => exam.id)).toEqual([
        examIds[4],
      ]);
      expect((await read(users[0], { page: "3", pageSize: "2" })).data).toEqual(
        [],
      );
    });
  });
});
