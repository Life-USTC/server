import { vi } from "vitest";
import { createCalendarContractFixture } from "../e2e/utils/calendar-contract";
import { DEV_SEED } from "../fixtures/dev-seed";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";
import type { TestPrismaClient } from "../shared/prisma";

const it = nodeProtocolTest.extend<{ calendarDb: TestPrismaClient }>({
  calendarDb: async ({ isolatedDatabase, protocolRuntime }, use) => {
    const db = isolatedDatabase.owner;
    await protocolRuntime.run(() =>
      db.semester.create({
        data: {
          jwId: DEV_SEED.semesterJwId,
          code: "calendar-fixture",
          nameCn: "Calendar fixture semester",
          startDate: new Date("2026-02-01"),
          endDate: new Date("2026-07-01"),
        },
      }),
    );
    await use(db);
  },
});

it(
  "calendar fixture setup rolls back users when a later course insert fails",
  { tags: ["@Infrastructure/Runtime"] },
  async ({ expect, calendarDb: db, protocolRuntime }) =>
    protocolRuntime.run(async () => {
      const fixture = await createCalendarContractFixture(async (run) =>
        run(db),
      );
      const attemptedUsers: string[] = [];
      try {
        await expect(
          createCalendarContractFixture(async (run) =>
            run({
              $transaction: (action) =>
                db.$transaction(async (tx) => {
                  const createUser = tx.user.create.bind(tx.user);
                  const createCourse = tx.course.create.bind(tx.course);
                  // These delegates belong only to this transaction, never another test.
                  const user = vi
                    .spyOn(tx.user, "create")
                    .mockImplementation((args) => {
                      attemptedUsers.push(args.data.username as string);
                      return createUser(args);
                    });
                  const course = vi
                    .spyOn(tx.course, "create")
                    .mockImplementation((args) =>
                      createCourse({
                        ...args,
                        data: { ...args.data, jwId: fixture.course.jwId },
                      }),
                    );
                  try {
                    return await action(tx);
                  } finally {
                    user.mockRestore();
                    course.mockRestore();
                  }
                }),
            }),
          ),
        ).rejects.toMatchObject({ code: "P2002" });
        expect(attemptedUsers).toHaveLength(2);
        expect(
          await db.user.findMany({
            where: { username: { in: attemptedUsers } },
          }),
        ).toEqual([]);
        expect(
          await db.course.findUnique({ where: { id: fixture.course.id } }),
        ).toEqual(fixture.course);
      } finally {
        await fixture.cleanup();
      }
    }),
);

it(
  "concurrent calendar fixtures own distinct state and cleanup preserves their neighbor",
  { tags: ["@Infrastructure/Runtime"] },
  async ({ expect, calendarDb: db, protocolRuntime }) =>
    protocolRuntime.run(async () => {
      const results = await Promise.allSettled([
        createCalendarContractFixture(async (run) => run(db)),
        createCalendarContractFixture(async (run) => run(db)),
      ]);
      const fixtures = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      try {
        for (const result of results)
          if (result.status === "rejected") throw result.reason;
        const [own, foreign] = fixtures;
        expect(own.course.id).not.toBe(foreign.course.id);
        expect(own.users.map(({ id }) => id)).not.toContain(
          foreign.users[0].id,
        );
        await db.todo.update({
          where: { id: own.todo.id },
          data: { completed: true },
        });
        expect(
          await db.todo.findUnique({ where: { id: foreign.todo.id } }),
        ).toEqual(foreign.todo);
        // Rows created by an operation after setup also belong to this section.
        const extraHomework = await db.homework.create({
          data: {
            sectionId: own.section.id,
            title: "fixture-owned extra homework",
          },
        });
        const audit = await db.auditLog.create({
          data: {
            action: "homework_create",
            outcome: "success",
            targetType: "homework",
            targetId: extraHomework.id,
          },
        });
        const observation = await db.featureOperationEvent.create({
          data: {
            userId: own.users[0].id,
            feature: "community.section-homework",
            operation: "create",
            protocol: "rest",
            surface: "web",
            authMode: "session",
            outcome: "success",
            errorClass: "none",
            durationMs: 1,
          },
        });
        await own.cleanup();
        fixtures.shift();
        expect(
          await db.user.count({
            where: { id: { in: own.users.map(({ id }) => id) } },
          }),
        ).toBe(0);
        expect(
          await db.course.findUnique({ where: { id: own.course.id } }),
        ).toBeNull();
        expect(
          await db.homework.findUnique({ where: { id: extraHomework.id } }),
        ).toBeNull();
        expect(
          await db.auditLog.findUnique({ where: { id: audit.id } }),
        ).toBeNull();
        expect(
          await db.featureOperationEvent.findUnique({
            where: { id: observation.id },
          }),
        ).toBeNull();
        expect(
          await db.todo.findUnique({ where: { id: foreign.todo.id } }),
        ).toEqual(foreign.todo);
        expect(
          await db.course.findUnique({ where: { id: foreign.course.id } }),
        ).toEqual(foreign.course);
      } finally {
        const cleanup = await Promise.allSettled(
          fixtures.map((fixture) => fixture.cleanup()),
        );
        const errors = cleanup.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        );
        expect(errors, "Calendar fixture cleanup failed").toEqual([]);
      }
    }),
);
