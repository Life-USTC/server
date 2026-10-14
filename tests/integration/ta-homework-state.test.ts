import pg from "pg";
import { describe, expect, vi } from "vitest";
import { getIncompleteHomeworkCalendarItems } from "@/features/calendar/server/calendar-export-data";
import { listSubscribedHomeworkPage } from "@/features/subscriptions/server/subscription-homework-page";
import { updateSubscriptionKind } from "@/features/subscriptions/server/subscription-kind";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";

const now = new Date("2026-09-13T08:00:00Z");
const future = new Date(now.getTime() + 60_000);

const it = nodeProtocolTest.extend(
  "homework",
  async ({ isolatedDatabase: { owner: db }, protocolRuntime }) =>
    protocolRuntime.run(async () => {
      const { users, ids, section } = await db.$transaction(async (tx) => {
        const users = [crypto.randomUUID(), crypto.randomUUID()];
        const ids = Array.from({ length: 4 }, () => crypto.randomUUID());
        const semester = await tx.semester.create({
          data: {
            jwId: 1,
            code: "ta-homework",
            nameCn: "TA homework semester",
          },
        });
        const course = await tx.course.create({
          data: {
            jwId: 1,
            code: "TA-HOMEWORK",
            nameCn: "助教课程",
            nameEn: "TA homework course",
          },
        });
        const section = await tx.section.create({
          data: {
            semesterId: semester.id,
            courseId: course.id,
            jwId: 1,
            code: "[integration-test] TA-HOMEWORK.01",
          },
          select: { id: true, jwId: true },
        });
        await tx.user.createMany({
          data: users.map((id) => ({
            id,
            name: "TA homework test",
            email: `${id}@ta.test`,
          })),
        });
        await tx.userSectionSubscription.createMany({
          data: users.map((userId, index) => ({
            userId,
            sectionId: section.id,
            kind: index === 0 ? "teaching_assistant" : "regular",
          })),
        });
        await tx.homework.createMany({
          data: ids.map((id, index) => ({
            id,
            title: `[integration-test] TA state ${index}`,
            sectionId: section.id,
            submissionDueAt: index === 2 ? null : index === 1 ? future : now,
          })),
        });
        await tx.homeworkCompletion.create({
          data: { userId: users[0], homeworkId: ids[3], completedAt: now },
        });
        return { users, ids, section };
      });
      function read(userId: string, completed?: boolean, pageSize = 20) {
        return protocolRuntime.request(() =>
          listSubscribedHomeworkPage(userId, {
            completed,
            now,
            pagination: { page: 1, pageSize },
          }),
        );
      }
      async function expectCompletionPreserved() {
        expect(
          await db.homeworkCompletion.findMany({
            where: { homeworkId: { in: ids } },
            select: { userId: true, homeworkId: true, completedAt: true },
          }),
        ).toEqual([{ userId: users[0], homeworkId: ids[3], completedAt: now }]);
      }
      return { db, users, ids, section, read, expectCompletionPreserved };
    }),
);

describe("known homework state consumers", () => {
  it("loads public homework relations after committing the bounded viewer transaction", {
    tags: ["@Homework/Service"],
  }, async ({ homework, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const { db, users, ids } = homework;
      await db.homework.updateMany({
        where: { id: { in: ids } },
        data: { createdById: users[0], updatedById: users[1] },
      });
      const queries = vi.spyOn(pg.Client.prototype, "query");
      try {
        const page = await protocolRuntime.request(() =>
          listSubscribedHomeworkPage(users[0], {
            locale: "en-us",
            includeEditors: true,
            now,
            pagination: { page: 1, pageSize: 20 },
          }),
        );
        const statements = queries.mock.calls.map(([query]) =>
          typeof query === "string" ? query : (query as pg.QueryConfig).text,
        );
        const begin = statements.indexOf("BEGIN");
        const commit = statements.indexOf("COMMIT");
        expect(begin).toBeGreaterThanOrEqual(0);
        expect(commit).toBeGreaterThan(begin);
        const scoped = statements.slice(begin + 1, commit);
        // RLS setup, homework page + comment aggregate, completions, total,
        // and subscription kinds. Public catalog/editor joins belong after COMMIT.
        expect(scoped.length).toBeLessThanOrEqual(5);
        expect(
          statements
            .slice(commit + 1)
            .some((sql) => sql.includes('"public"."Course"')),
        ).toBe(true);
        expect(page.pagination.total).toBe(4);
        expect(page.data).toHaveLength(4);
        expect(
          page.data.every(
            (row) => row.section?.course?.namePrimary === "TA homework course",
          ),
        ).toBe(true);
        expect(
          page.data.every(
            (row) =>
              row.createdBy?.id === users[0] && row.updatedBy?.id === users[1],
          ),
        ).toBe(true);
        expect(
          page.data.find((row) => row.id === ids[3])?.completion?.completedAt,
        ).toEqual(now);
        expect(page.data.every((row) => row.completionRequired === false)).toBe(
          true,
        );
      } finally {
        queries.mockRestore();
      }
    });
  });

  it("keeps concurrent localized pages, completions and comment counts viewer-scoped", {
    tags: ["@Homework/Service"],
  }, async ({ homework, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const { db, users, ids, section } = homework;
      await db.comment.createMany({
        data: [
          {
            homeworkId: ids[0],
            userId: users[0],
            body: "public",
            visibility: "public",
          },
          {
            homeworkId: ids[0],
            userId: users[1],
            body: "signed in",
            visibility: "logged_in_only",
          },
          {
            homeworkId: ids[0],
            userId: users[0],
            body: "own hidden",
            status: "softbanned",
          },
          {
            homeworkId: ids[0],
            userId: users[1],
            body: "deleted",
            status: "deleted",
          },
        ],
      });
      const read = (index: number) =>
        protocolRuntime.request(() =>
          listSubscribedHomeworkPage(users[index], {
            locale: index === 0 ? "en-us" : "zh-cn",
            includeEditors: true,
            now,
            pagination: { page: 1, pageSize: 20 },
          }),
        );
      const pages = await Promise.all(
        Array.from({ length: 8 }, (_, index) => read(index % 2)),
      );
      pages.forEach((page, index) => {
        const owner = index % 2 === 0;
        expect(page.pagination.total).toBe(4);
        expect(page.data.find((row) => row.id === ids[0])).toMatchObject({
          commentCount: owner ? 3 : 2,
          completionRequired: !owner,
          section: {
            course: { namePrimary: owner ? "TA homework course" : "助教课程" },
          },
        });
        expect(page.data.find((row) => row.id === ids[3])?.completion).toEqual(
          owner ? { completedAt: now } : null,
        );
        expect(
          page.data.every(
            (row) => !("_count" in row) && !("homeworkCompletions" in row),
          ),
        ).toBe(true);
      });
      await db.userSectionSubscription.deleteMany({
        where: { userId: users[0], sectionId: section.id },
      });
      expect((await read(0)).data).toEqual([]);
      expect((await read(1)).pagination.total).toBe(4);
    });
  });

  it("filters TA deadlines before pagination and excludes undated work from calendar", {
    tags: ["@Homework/Service"],
  }, async ({ homework, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const { users, ids, section, read } = homework;
      const pending = await read(users[0], false, 1);
      expect(pending.pagination.total).toBe(2);
      expect(pending.data).toHaveLength(1);
      expect(pending.data[0]).toMatchObject({
        id: ids[1],
        completionRequired: false,
      });
      expect(
        (
          await protocolRuntime.request(() =>
            getIncompleteHomeworkCalendarItems(users[0], [section.id], now),
          )
        ).map((row) => row.id),
      ).toEqual([ids[1]]);
    });
  });

  it("shows real TA completion independently of the completion requirement", {
    tags: ["@Homework/Service"],
  }, async ({ homework, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const { users, ids, read, expectCompletionPreserved } = homework;
      const all = await read(users[0]);
      expect(all.pagination.total).toBe(4);
      expect(
        all.data
          .map((row) => ({
            id: row.id,
            completionRequired: row.completionRequired,
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      ).toEqual(
        ids
          .map((id) => ({ id, completionRequired: false }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      );
      expect(
        all.data.find((row) => row.id === ids[3])?.completion,
      ).not.toBeNull();
      expect((await read(users[0], true)).data.map((row) => row.id)).toEqual([
        ids[3],
      ]);
      await expectCompletionPreserved();
    });
  });

  it("keeps a regular subscriber's pending work independent of another owner's completion", {
    tags: ["@Homework/Service"],
  }, async ({ homework, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const { users, ids, read, expectCompletionPreserved } = homework;
      const pending = await read(users[1], false);
      expect(pending.pagination.total).toBe(4);
      expect(pending.data.map((row) => row.id).sort()).toEqual([...ids].sort());
      expect(
        pending.data.every(
          (row) => row.completionRequired && row.completion === null,
        ),
      ).toBe(true);
      expect((await read(users[1], true)).data).toEqual([]);
      await expectCompletionPreserved();
    });
  });

  it.for([
    { name: "before now", dueAt: new Date(now.getTime() - 1), include: false },
    { name: "at now", dueAt: now, include: false },
    { name: "in the future", dueAt: future, include: true },
    { name: "without a deadline", dueAt: null, include: true },
  ])(
    "projects TA work $name without modifying completion",
    { tags: ["@Homework/Service"] },
    async ({ dueAt, include }, { homework, protocolRuntime }) => {
      await protocolRuntime.run(async () => {
        const { db, users, ids, read, expectCompletionPreserved } = homework;
        await db.homework.update({
          where: { id: ids[0] },
          data: { submissionDueAt: dueAt },
        });
        const expected = include ? [ids[0], ids[1], ids[2]] : [ids[1], ids[2]];
        const pending = await read(users[0], false);
        expect(pending.pagination.total).toBe(expected.length);
        expect(pending.data.map((row) => row.id).sort()).toEqual(
          expected.sort(),
        );
        await expectCompletionPreserved();
      });
    },
  );
});

it.for([
  {
    before: "teaching_assistant",
    after: "auditor",
    pendingBefore: 2,
    pendingAfter: 3,
    required: true,
  },
  {
    before: "auditor",
    after: "teaching_assistant",
    pendingBefore: 3,
    pendingAfter: 2,
    required: false,
  },
] as const)(
  "changing $before to $after updates consumers and preserves completion",
  { tags: ["@Homework/Service"] },
  async (scenario, { homework, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const { db, users, section, read, expectCompletionPreserved } = homework;
      await db.userSectionSubscription.update({
        where: {
          userId_sectionId: { userId: users[0], sectionId: section.id },
        },
        data: { kind: scenario.before },
      });
      expect((await read(users[0], false)).pagination.total).toBe(
        scenario.pendingBefore,
      );
      await protocolRuntime.request(() =>
        updateSubscriptionKind({
          userId: users[0],
          sectionJwId: section.jwId,
          kind: scenario.after,
        }),
      );
      expect(
        await db.userSectionSubscription.findMany({
          where: { sectionId: section.id },
          select: { userId: true, kind: true },
          orderBy: { userId: "asc" },
        }),
      ).toEqual(
        [
          { userId: users[0], kind: scenario.after },
          { userId: users[1], kind: "regular" },
        ].sort((a, b) => a.userId.localeCompare(b.userId)),
      );
      expect((await read(users[0], false)).pagination.total).toBe(
        scenario.pendingAfter,
      );
      expect(
        (await read(users[0])).data.every(
          (row) => row.completionRequired === scenario.required,
        ),
      ).toBe(true);
      await expectCompletionPreserved();
    });
  },
);
