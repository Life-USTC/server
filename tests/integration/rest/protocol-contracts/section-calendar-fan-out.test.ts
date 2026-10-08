import { expect } from "@playwright/test";
import { test } from "../../../e2e/utils/owned-worker";

type CalendarState = {
  attempts: {
    id: string;
    attempts: number;
    userId: string;
    sectionId?: number;
    ackCalls: number;
    retryCalls: number;
    complete: boolean;
    errors: string[];
    calendar: string | null;
  }[];
  calendar: string | null;
};

for (const operation of ["create", "update", "delete"] as const) {
  test(`section homework ${operation} rebuilds only subscriber calendars`, {
    tag: "@Homework/REST",
  }, async ({ isolatedWorker, run }) => {
    await run(async () => {
      const db = isolatedWorker.database.owner;
      const actors = [];
      for (let index = 0; index < 4; index++)
        actors.push(await isolatedWorker.createActor());
      const [author, subscriber, otherSectionSubscriber, nonSubscriber] =
        actors;
      const original = {
        title: "Original section homework",
        submissionDueAt: "2099-06-10T09:30:00+08:00",
      };
      const changed = {
        title: "Changed section homework",
        submissionDueAt: "2099-06-11T11:45:00+08:00",
      };
      const { section, otherSection, homework } = await db.$transaction(
        async (tx) => {
          const semester = await tx.semester.create({
            data: { jwId: 1, code: "fan-out", nameCn: "独立日历学期" },
          });
          const course = await tx.course.create({
            data: { jwId: 1, code: "FAN", nameCn: "Fan-out course" },
          });
          const sections = [];
          for (const jwId of [1, 2])
            sections.push(
              await tx.section.create({
                data: {
                  jwId,
                  code: `FAN.${jwId}`,
                  courseId: course.id,
                  semesterId: semester.id,
                },
              }),
            );
          const homework =
            operation === "create"
              ? null
              : await tx.homework.create({
                  data: {
                    ...original,
                    submissionDueAt: new Date(original.submissionDueAt),
                    sectionId: sections[0].id,
                    createdById: author.id,
                  },
                });
          return {
            section: sections[0],
            otherSection: sections[1],
            homework,
          };
        },
      );
      const secret = {
        "x-test-storage-secret": "local-test-storage-observer",
      };
      const path = (userId: string) =>
        `/__test/calendar-consumer?userId=${userId}&sectionId=${section.id}`;
      const read = async (userId: string): Promise<CalendarState> => {
        const response = await author.request.get(path(userId), {
          headers: secret,
        });
        expect(response.status()).toBe(200);
        return response.json();
      };
      const text = (state: CalendarState) => {
        expect(state.calendar).not.toBeNull();
        return (JSON.parse(state.calendar as string).text as string).replace(
          /\r?\n[ \t]/g,
          "",
        );
      };
      for (const actor of actors) {
        const registered = await author.request.post(path(actor.id), {
          headers: secret,
        });
        expect(registered.status()).toBe(201);
        await registered.body();
      }
      // Real user messages establish the independent baseline without a feed read.
      for (const actor of [author, subscriber, otherSectionSubscriber]) {
        const added = await actor.request.post(
          "/api/workspace/subscriptions/batch",
          {
            data: {
              action: "add",
              sectionIds: [
                actor === otherSectionSubscriber ? otherSection.id : section.id,
              ],
            },
          },
        );
        expect(added.status()).toBe(200);
        expect(await added.json()).toMatchObject({ addedCount: 1 });
        await expect
          .poll(
            async () => {
              const state = await read(actor.id);
              return state.attempts.length === 1 && state.attempts[0].complete;
            },
            { timeout: 10_000 },
          )
          .toBe(true);
        const baseline = await read(actor.id);
        expect(baseline.attempts[0]).toMatchObject({
          ackCalls: 1,
          retryCalls: 0,
          complete: true,
          errors: [],
        });
        expect(text(baseline)).toContain("BEGIN:VCALENDAR");
        if (homework && actor !== otherSectionSubscriber) {
          expect(text(baseline)).toContain(
            `UID:https://life-ustc.tiankaima.dev/homework/${homework.id}`,
          );
          expect(text(baseline)).toContain(
            `SUMMARY:Fan-out course - 作业截止：${original.title}`,
          );
          expect(text(baseline)).toContain(
            "DTSTART;TZID=Asia/Shanghai:20990610T093000",
          );
        }
      }
      const outsidersBefore = await Promise.all(
        [otherSectionSubscriber, nonSubscriber].map((actor) => read(actor.id)),
      );
      expect(outsidersBefore[1].calendar).toBeNull();
      let homeworkId = homework?.id;
      try {
        if (operation === "create") {
          const response = await author.request.post(
            "/api/community/section-homeworks",
            {
              data: { ...changed, sectionJwId: section.jwId },
            },
          );
          expect(response.status()).toBe(201);
          homeworkId = (await response.json()).id;
        } else if (operation === "update") {
          const response = await author.request.patch(
            `/api/community/section-homeworks/${homeworkId}`,
            {
              data: changed,
            },
          );
          expect(response.status()).toBe(200);
          await response.json();
        } else {
          const response = await author.request.delete(
            `/api/community/section-homeworks/${homeworkId}`,
          );
          expect(response.status()).toBe(200);
          expect(await response.json()).toEqual({ success: true });
        }
        expect(homeworkId).toEqual(expect.any(String));
        const stored = await db.homework.findUniqueOrThrow({
          where: { id: homeworkId },
        });
        expect(stored.deletedAt === null).toBe(operation !== "delete");
        if (operation !== "delete") {
          expect(stored.title).toBe(changed.title);
          expect(stored.submissionDueAt).toEqual(
            new Date(changed.submissionDueAt),
          );
        }
        for (const actor of actors) {
          await expect
            .poll(
              async () => {
                const state = await read(actor.id);
                const attempts = state.attempts.filter(
                  (attempt) => attempt.sectionId === section.id,
                );
                return attempts.length === 1 && attempts[0].complete;
              },
              { timeout: 10_000 },
            )
            .toBe(true);
          const state = await read(actor.id);
          const attempts = state.attempts.filter(
            (attempt) => attempt.sectionId === section.id,
          );
          expect(attempts).toHaveLength(1);
          expect(attempts[0]).toMatchObject({
            attempts: 1,
            userId: actor.id,
            sectionId: section.id,
            ackCalls: 1,
            retryCalls: 0,
            complete: true,
            errors: [],
            calendar: state.calendar,
          });
          if (actor === author || actor === subscriber) {
            const calendar = text(state);
            if (operation === "delete") {
              expect(calendar).not.toContain(
                `UID:https://life-ustc.tiankaima.dev/homework/${homeworkId}`,
              );
              expect(calendar).not.toContain(original.title);
              expect(calendar).not.toContain("BEGIN:VEVENT");
            } else {
              expect(calendar).toContain(
                `UID:https://life-ustc.tiankaima.dev/homework/${homeworkId}`,
              );
              expect(calendar).toContain(
                `SUMMARY:Fan-out course - 作业截止：${changed.title}`,
              );
              expect(calendar).toContain(
                "DTSTART;TZID=Asia/Shanghai:20990611T114500",
              );
              expect(calendar).not.toContain(original.title);
            }
          } else {
            const before =
              outsidersBefore[actor === otherSectionSubscriber ? 0 : 1];
            expect(state.calendar).toBe(before.calendar);
          }
        }
      } finally {
        await db.userSectionSubscription.findMany();
        await Promise.all(actors.map((actor) => read(actor.id)));
      }
    });
  });
}
