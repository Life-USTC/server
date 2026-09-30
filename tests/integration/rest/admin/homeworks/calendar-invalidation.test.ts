import { expect } from "@playwright/test";
import { base, test } from "./_fixture";

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
type ProducerState = {
  messages: {
    outcome: string;
    value?: { type?: string; sectionId?: number };
  }[];
};

test("administrator homework deletion rebuilds a subscriber calendar once across replay", async ({
  isolatedWorker,
  run,
  homeworkState: state,
}, testInfo) => {
  await run(async () => {
    const subscriber = await isolatedWorker.createActor();
    const { db, admin, section, catalog, homeworks } = state;
    const homework = homeworks[0];
    // Independent consumer state: do not subscribe through the mutation route.
    const subscription = await db.userSectionSubscription.create({
      data: { userId: subscriber.id, sectionId: section.id, kind: "regular" },
    });
    const secret = { "x-test-storage-secret": "local-test-storage-observer" };
    const probeId = crypto.randomUUID();
    const producerPath = `/__test/community-effects?id=${probeId}`;
    const consumerPath = `/__test/calendar-consumer?userId=${subscriber.id}&sectionId=${section.id}`;
    const headers = { ...secret, "x-test-community-probe": probeId };
    const readEffects = async (): Promise<ProducerState> => {
      // Drains tagged handler streams and waitUntil, including replay enqueue.
      const response = await admin.request.get(producerPath, {
        headers: secret,
      });
      expect(response.status()).toBe(200);
      return response.json();
    };
    const readCalendar = async (): Promise<CalendarState> => {
      // This observes stored KV; it never repairs or rebuilds the export.
      const response = await admin.request.get(consumerPath, {
        headers: secret,
      });
      expect(response.status()).toBe(200);
      return response.json();
    };
    const calendarText = (calendar: CalendarState) => {
      expect(calendar.calendar).toEqual(expect.any(String));
      const stored = JSON.parse(calendar.calendar as string);
      expect(stored.version).toBe(2);
      expect(stored.text).toEqual(expect.any(String));
      return (stored.text as string).replace(/\r?\n[ \t]/g, "");
    };
    const readRows = async () => ({
      homework: await db.homework.findUniqueOrThrow({
        where: { id: homework.id },
      }),
      otherHomeworks: await db.homework.findMany({
        where: { id: { in: [homeworks[1].id, homeworks[2].id] } },
        orderBy: { createdAt: "asc" },
      }),
      audits: await db.auditLog.findMany({
        where: { action: "homework_delete" },
      }),
      subscriptions: await db.userSectionSubscription.findMany(),
    });
    let producerRegistered = false;
    const failures: unknown[] = [];
    try {
      for (const path of [producerPath, consumerPath]) {
        const response = await admin.request.post(path, { headers: secret });
        if (path === producerPath && response.status() === 201)
          producerRegistered = true;
        expect(response.status()).toBe(201);
        await response.body();
      }
      // Prime only before moderation. A later feed GET could hide lost invalidation.
      const feed = await subscriber.request.get(
        `/api/calendar-feeds/${subscriber.id}.ics`,
        { headers },
      );
      expect(feed.status()).toBe(200);
      const feedText = (await feed.text()).replace(/\r?\n[ \t]/g, "");
      expect(await readEffects()).toMatchObject({
        backgroundErrors: [],
        purges: [],
        messages: [],
      });
      const before = await readCalendar();
      expect(before.attempts).toEqual([]);
      const beforeText = calendarText(before);
      expect(beforeText).toBe(feedText);
      expect(beforeText).toContain("BEGIN:VCALENDAR");
      expect(beforeText.match(/BEGIN:VEVENT/g)).toHaveLength(2);
      for (const [id, title] of [
        [homeworks[0].id, "Older homework"],
        [homeworks[1].id, "Recent homework"],
      ]) {
        expect(beforeText).toContain(
          `UID:https://life-ustc.tiankaima.dev/homework/${id}`,
        );
        expect(beforeText).toContain(
          `SUMMARY:${catalog.courses[0].nameCn} - 作业截止：${title}`,
        );
      }
      expect(
        beforeText.match(/DTSTART;TZID=Asia\/Shanghai:21000101T080000/g),
      ).toHaveLength(2);
      expect(beforeText).not.toContain("Deleted homework");
      expect(beforeText).not.toContain(
        `UID:https://life-ustc.tiankaima.dev/homework/${homeworks[2].id}`,
      );
      expect(await readRows()).toEqual({
        homework,
        otherHomeworks: [homeworks[1], homeworks[2]],
        audits: [],
        subscriptions: [subscription],
      });
      await testInfo.attach("admin-homework-calendar-before", {
        body: JSON.stringify(before),
        contentType: "application/json",
      });

      let committed: Awaited<ReturnType<typeof readRows>> | undefined;
      let consumed: CalendarState | undefined;
      for (const phase of ["delete", "replay"] as const) {
        const response = await admin.request.delete(`${base}/${homework.id}`, {
          headers,
        });
        expect(response.status()).toBe(200);
        expect(await response.json()).toEqual({ success: true });
        const effects = await readEffects();
        expect(effects).toMatchObject({
          backgroundErrors: [],
          purges: [],
          messages: [
            {
              outcome: "fulfilled",
              value: { type: "section", sectionId: section.id },
            },
          ],
        });
        const rows = await readRows();
        expect(rows.homework).toEqual({
          ...homework,
          deletedAt: expect.any(Date),
          deletedById: admin.id,
          updatedAt: expect.any(Date),
          updatedById: admin.id,
        });
        expect(rows.otherHomeworks).toEqual([homeworks[1], homeworks[2]]);
        expect(rows.subscriptions).toEqual([subscription]);
        expect(rows.audits).toHaveLength(1);
        expect(rows.audits[0]).toMatchObject({
          action: "homework_delete",
          targetId: homework.id,
          targetType: "homework",
          userId: admin.id,
          subjectUserId: admin.id,
          channel: "rest",
          outcome: "success",
          metadata: { sectionId: section.id },
        });
        await expect
          .poll(
            async () => {
              const calendar = await readCalendar();
              return (
                calendar.attempts.length === 1 && calendar.attempts[0].complete
              );
            },
            { timeout: 10_000 },
          )
          .toBe(true);
        const calendar = await readCalendar();
        expect(calendar.attempts).toHaveLength(1);
        expect(calendar.attempts[0]).toEqual({
          id: expect.any(String),
          attempts: 1,
          userId: subscriber.id,
          sectionId: section.id,
          ackCalls: 1,
          retryCalls: 0,
          complete: true,
          errors: [],
          calendar: calendar.calendar,
        });
        const afterText = calendarText(calendar);
        expect(afterText).toContain("BEGIN:VCALENDAR");
        expect(afterText.match(/BEGIN:VEVENT/g)).toHaveLength(1);
        expect(afterText).toContain(
          `UID:https://life-ustc.tiankaima.dev/homework/${homeworks[1].id}`,
        );
        expect(afterText).toContain(
          `SUMMARY:${catalog.courses[0].nameCn} - 作业截止：Recent homework`,
        );
        expect(afterText).toContain("DTSTART;TZID=Asia/Shanghai:21000101T080000");
        expect(afterText).not.toContain("Older homework");
        expect(afterText).not.toContain("Deleted homework");
        for (const id of [homeworks[0].id, homeworks[2].id]) {
          expect(afterText).not.toContain(
            `UID:https://life-ustc.tiankaima.dev/homework/${id}`,
          );
        }
        // Fixed oracles above apply to both calls; equality additionally detects
        // replay rewriting timestamps, audit identities, or the stored export.
        if (phase === "replay") {
          expect(rows).toEqual(committed);
          expect(calendar).toEqual(consumed);
        } else {
          committed = rows;
          consumed = calendar;
        }
        await testInfo.attach(`admin-homework-calendar-${phase}`, {
          body: JSON.stringify({ rows, effects, calendar }),
          contentType: "application/json",
        });
      }
    } catch (error) {
      failures.push(error);
    } finally {
      const [effects] = await Promise.allSettled([readEffects()]);
      // This actual count is only a teardown obligation. It never replaces the
      // fixed one-message/one-ack/ICS assertions in the successful workflow.
      const consumerDrain = await Promise.allSettled(
        effects.status === "fulfilled"
          ? [
              (async () => {
                expect(Array.isArray(effects.value.messages)).toBe(true);
                const submitted = effects.value.messages.filter(
                  (message) =>
                    message.outcome === "fulfilled" &&
                    message.value?.type === "section" &&
                    message.value.sectionId === section.id,
                ).length;
                if (submitted === 0) return;
                // Keep joining real consumer work after a body failure/timeout;
                // do not race or cancel an in-flight observation at the deadline.
                const deadline = Date.now() + 15_000;
                while (true) {
                  const calendar = await readCalendar();
                  const attempts = calendar.attempts.filter(
                    (attempt) =>
                      attempt.userId === subscriber.id &&
                      attempt.sectionId === section.id,
                  );
                  const acknowledged = new Set(
                    attempts
                      .filter(
                        (attempt) =>
                          attempt.complete &&
                          attempt.ackCalls > 0 &&
                          attempt.retryCalls === 0,
                      )
                      .map((attempt) => attempt.id),
                  );
                  if (
                    acknowledged.size >= submitted &&
                    attempts.every((attempt) => attempt.complete)
                  )
                    return { submitted, calendar };
                  if (Date.now() >= deadline)
                    throw new Error(
                      `Calendar teardown did not settle ${submitted} submitted section messages`,
                    );
                  await new Promise((resolve) => setTimeout(resolve, 100));
                }
              })(),
            ]
          : [],
      );
      // A failed producer read remains a cleanup error; it is never treated as
      // zero messages. Attempt all remaining observations and release anyway.
      const observations = await Promise.allSettled([readRows(), readCalendar()]);
      // Consumer registrations belong to this private Worker/KV and have no
      // DELETE endpoint. Release the producer UUID only after draining it.
      const cleanup = await Promise.allSettled(
        producerRegistered
          ? [
              (async () => {
                const response = await admin.request.delete(producerPath, {
                  headers: secret,
                });
                await response.body();
                expect(response.status()).toBe(204);
              })(),
            ]
          : [],
      );
      const results = [effects, ...consumerDrain, ...observations, ...cleanup];
      for (const result of results)
        if (result.status === "rejected") failures.push(result.reason);
      const attachment = await Promise.allSettled([
        (async () => {
          await testInfo.attach("admin-homework-calendar-final", {
            body: JSON.stringify({
              failures: failures.map(String),
              observations: results.map((result) =>
                result.status === "fulfilled"
                  ? result
                  : { status: result.status, reason: String(result.reason) },
              ),
            }),
            contentType: "application/json",
          });
        })(),
      ]);
      for (const result of attachment)
        if (result.status === "rejected") failures.push(result.reason);
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1)
      throw new AggregateError(failures, "Administrator calendar workflow failed");
  });
});
