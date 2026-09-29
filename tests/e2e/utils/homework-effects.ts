import { expect, type Page, type TestInfo } from "@playwright/test";
import type { IsolatedWorker } from "./isolated-worker";

type CalendarMessage =
  | { type: "section"; sectionId: number }
  | { type: "user"; userId: string };
export type HomeworkEffects = {
  calendarMessages: CalendarMessage[];
  auditActions?: Partial<
    Record<
      | "homework_create"
      | "homework_update"
      | "homework_delete"
      | "comment_create",
      number
    >
  >;
};
type CalendarObservation = {
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
type ProducerObservation = {
  messages: { outcome: string; value: CalendarMessage }[];
  purges: { outcome: string }[];
  backgroundErrors: string[];
};

/** Explicit scenario expectations; observers never derive them from the producer. */
export async function withHomeworkEffects(
  {
    page,
    isolatedWorker,
    account,
    sectionId,
    testInfo,
    calendarMessages,
    auditActions = {},
  }: HomeworkEffects & {
    page: Page;
    isolatedWorker: IsolatedWorker;
    account: { id: string };
    sectionId?: number;
    testInfo: TestInfo;
  },
  work: (effects: { headers: Record<string, string> }) => Promise<void>,
) {
  const request = page.request;
  const db = isolatedWorker.database.owner;
  const secret = { "x-test-storage-secret": "local-test-storage-observer" };
  const id = crypto.randomUUID();
  const headers = { ...secret, "x-test-community-probe": id };
  const producerPath = `/__test/community-effects?id=${id}`;
  const consumerPath = `/__test/calendar-consumer?userId=${account.id}${sectionId === undefined ? "" : `&sectionId=${sectionId}`}`;
  const pending = new Set<Promise<void>>();
  const errors: unknown[] = [];
  const writes: { method: string; path: string; status: number }[] = [];
  let accepting = true;
  let registered = false;

  async function observe() {
    let snapshot:
      | { producer: ProducerObservation; consumer: CalendarObservation }
      | undefined;
    await expect
      .poll(
        async () => {
          const producerResponse = await request.get(producerPath, {
            headers: secret,
          });
          expect(producerResponse.status()).toBe(200);
          const producer: ProducerObservation = await producerResponse.json();
          const consumerResponse = await request.get(consumerPath, {
            headers: secret,
          });
          expect(consumerResponse.status()).toBe(200);
          const consumer: CalendarObservation = await consumerResponse.json();
          snapshot = { producer, consumer };
          return (
            producer.messages.length >= calendarMessages.length &&
            consumer.attempts.length >= calendarMessages.length &&
            consumer.attempts.every((attempt) => attempt.complete)
          );
        },
        {
          timeout: 15_000,
          message: "Native homework calendar consumers complete",
        },
      )
      .toBe(true);
    if (!snapshot) throw new Error("Missing homework effect observations");
    const { producer, consumer } = snapshot;
    expect(producer.backgroundErrors).toEqual([]);
    expect(
      producer.purges.every((purge) => purge.outcome === "fulfilled"),
    ).toBe(true);
    expect(
      producer.messages.map((message) => JSON.stringify(message)).sort(),
    ).toEqual(
      calendarMessages
        .map((value) => JSON.stringify({ outcome: "fulfilled", value }))
        .sort(),
    );
    expect(consumer.attempts).toHaveLength(calendarMessages.length);
    expect(new Set(consumer.attempts.map((attempt) => attempt.id)).size).toBe(
      calendarMessages.length,
    );
    expect(
      consumer.attempts
        .map((attempt) =>
          JSON.stringify(
            attempt.sectionId === undefined
              ? { type: "user", userId: attempt.userId }
              : { type: "section", sectionId: attempt.sectionId },
          ),
        )
        .sort(),
    ).toEqual(
      calendarMessages.map((message) => JSON.stringify(message)).sort(),
    );
    for (const attempt of consumer.attempts) {
      expect(attempt).toMatchObject({
        attempts: 1,
        userId: account.id,
        ackCalls: 1,
        retryCalls: 0,
        complete: true,
        errors: [],
        calendar: expect.any(String),
      });
      const calendar = JSON.parse(attempt.calendar as string);
      expect(calendar).toMatchObject({ version: 2, text: expect.any(String) });
      expect(calendar.text).toContain("BEGIN:VCALENDAR");
      expect(calendar.text).toContain("END:VCALENDAR");
    }
    if (calendarMessages.length)
      expect(
        consumer.attempts.some(
          (attempt) => attempt.calendar === consumer.calendar,
        ),
      ).toBe(true);

    const actor = await db.user.findUniqueOrThrow({
      where: { id: account.id },
    });
    const expectedActions: Record<string, number> = { ...auditActions };
    if (actor.calendarFeedToken)
      expectedActions.account_calendar_token_create = 1;
    const readAudits = () =>
      db.auditLog.findMany({
        where: { userId: account.id },
        select: {
          action: true,
          channel: true,
          outcome: true,
          targetId: true,
          targetType: true,
          userId: true,
          subjectUserId: true,
        },
      });
    const expectedCount = Object.values(expectedActions).reduce(
      (sum, count) => sum + count,
      0,
    );
    await expect
      .poll(async () => (await readAudits()).length, {
        timeout: 15_000,
        message: "Actual homework and calendar token audits persist",
      })
      .toBe(expectedCount);
    const audits = await readAudits();
    const actualActions: Record<string, number> = {};
    for (const audit of audits) {
      actualActions[audit.action] = (actualActions[audit.action] ?? 0) + 1;
      expect(audit).toMatchObject({
        outcome: "success",
        userId: account.id,
        targetId: expect.any(String),
      });
      if (audit.action === "account_calendar_token_create")
        expect(audit).toEqual({
          action: "account_calendar_token_create",
          channel: "system",
          outcome: "success",
          targetId: account.id,
          targetType: "calendar_feed",
          userId: account.id,
          subjectUserId: account.id,
        });
    }
    expect(actualActions).toEqual(expectedActions);
    return {
      calendarMessages,
      auditActions,
      producer,
      consumer,
      audits,
      writes,
    };
  }

  try {
    expect((await request.get(producerPath)).status()).toBe(404);
    expect((await request.get(consumerPath)).status()).toBe(404);
    expect(
      (await request.post(producerPath, { headers: secret })).status(),
    ).toBe(201);
    expect(
      (await request.post(consumerPath, { headers: secret })).status(),
    ).toBe(201);
    registered = true;
    await page.route(
      (url) => url.origin === isolatedWorker.origin,
      async (route) => {
        if (
          !["POST", "PUT", "PATCH", "DELETE"].includes(route.request().method())
        )
          return route.continue();
        let fulfilled = false;
        const operation = (async () => {
          try {
            if (!accepting)
              throw new Error("Homework request started during teardown");
            const incoming = route.request();
            const response = await route.fetch({
              maxRedirects: 0,
              headers: { ...incoming.headers(), ...headers },
            });
            await response.body();
            // Deliver the genuine response before joining native asynchronous effects.
            await route.fulfill({ response });
            fulfilled = true;
            if (["POST", "PUT", "PATCH", "DELETE"].includes(incoming.method()))
              writes.push({
                method: incoming.method(),
                path: new URL(incoming.url()).pathname,
                status: response.status(),
              });
          } catch (error) {
            errors.push(error);
            if (!fulfilled)
              try {
                await route.abort("aborted");
              } catch (abortError) {
                errors.push(abortError);
              }
          }
        })();
        pending.add(operation);
        try {
          await operation;
        } finally {
          pending.delete(operation);
        }
      },
    );
    await page.route(
      (url) =>
        url.href === "https://www.googletagmanager.com/gtag/js?id=G-JNK35J2Q3R",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: "",
        }),
    );
    await work({ headers });
  } catch (error) {
    errors.push(error);
  } finally {
    accepting = false;
    while (pending.size) await Promise.all(pending);
    if (registered)
      try {
        await testInfo.attach("homework-effects", {
          body: JSON.stringify(await observe(), null, 2),
          contentType: "application/json",
        });
      } catch (error) {
        errors.push(error);
      }
    try {
      await page.close();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length)
    throw new AggregateError(errors, "Owned homework workflow failed");
}
