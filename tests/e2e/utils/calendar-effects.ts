import { type APIRequestContext, expect } from "@playwright/test";

export type CalendarMessage =
  | { type: "section"; sectionId: number }
  | { type: "user"; userId: string };
export type CalendarObservation = {
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
export type ProducerObservation = {
  messages: { outcome: string; value: CalendarMessage }[];
  purges: { outcome: string }[];
  backgroundErrors: string[];
  requests: {
    outcome: string;
    value: {
      method: string;
      path: string;
      requestId?: string;
      entrypoint?: "PublicSsr";
    };
    result: number;
  }[];
};

function messageKey(message: CalendarMessage) {
  return message.type === "user"
    ? `user:${message.userId}`
    : `section:${message.sectionId}`;
}

function compareMessages(left: CalendarMessage, right: CalendarMessage) {
  const leftKey = messageKey(left);
  const rightKey = messageKey(right);
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

/** Observe the real producer and native consumer without owning a page or
 * deriving the scenario's successful message plan from observed work. */
export function createCalendarEffectObserver({
  request,
  producerPath,
  account,
  sectionId,
  calendar: expectedCalendar = "present",
}: {
  request: APIRequestContext;
  producerPath: string;
  account: { id: string };
  sectionId?: number;
  calendar?: "present" | "absent";
}) {
  const secret = { "x-test-storage-secret": "local-test-storage-observer" };
  const consumerPath = `/__test/calendar-consumer?userId=${account.id}${sectionId === undefined ? "" : `&sectionId=${sectionId}`}`;
  async function collect(expectedMessages: number | "submitted") {
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
          const submitted = producer.messages.filter(
            ({ outcome }) => outcome === "fulfilled",
          ).length;
          const required =
            expectedMessages === "submitted"
              ? submitted
              : Math.max(expectedMessages, submitted);
          return (
            producer.messages.length >= required &&
            consumer.attempts.length >= required &&
            consumer.attempts.every((attempt) => attempt.complete)
          );
        },
        {
          timeout: 15_000,
          message: "Native calendar consumers complete",
        },
      )
      .toBe(true);
    if (!snapshot) throw new Error("Missing calendar effect observations");
    return snapshot;
  }

  return {
    async register() {
      const response = await request.post(consumerPath, { headers: secret });
      await response.body();
      expect(response.status()).toBe(201);
    },
    collect,
    assert(
      {
        producer,
        consumer,
      }: {
        producer: ProducerObservation;
        consumer: CalendarObservation;
      },
      calendarMessages: CalendarMessage[],
      completed = true,
    ) {
      expect(producer.backgroundErrors).toEqual([]);
      expect(
        producer.purges.every((purge) => purge.outcome === "fulfilled"),
      ).toBe(true);
      if (completed) {
        expect(
          [...producer.messages].sort((left, right) =>
            compareMessages(left.value, right.value),
          ),
        ).toEqual(
          [...calendarMessages]
            .sort(compareMessages)
            .map((value) => ({ outcome: "fulfilled", value })),
        );
      } else {
        // The original body error remains fatal. A partial workflow drains only
        // submitted work, but cannot exceed its planned message multiset.
        const remaining = [...calendarMessages];
        for (const { outcome, value } of producer.messages) {
          expect(outcome).toBe("fulfilled");
          const index = remaining.findIndex(
            (planned) => messageKey(planned) === messageKey(value),
          );
          expect(
            index,
            "Partial workflow submitted an unplanned calendar message",
          ).toBeGreaterThanOrEqual(0);
          expect(value).toEqual(remaining[index]);
          remaining.splice(index, 1);
        }
      }
      const consumedMessages = completed
        ? calendarMessages
        : producer.messages.map(({ value }) => value);
      expect(consumer.attempts).toHaveLength(consumedMessages.length);
      expect(new Set(consumer.attempts.map((attempt) => attempt.id)).size).toBe(
        consumedMessages.length,
      );
      expect(
        consumer.attempts
          .map((attempt): CalendarMessage =>
            attempt.sectionId === undefined
              ? { type: "user", userId: attempt.userId }
              : { type: "section", sectionId: attempt.sectionId },
          )
          .sort(compareMessages),
      ).toEqual([...consumedMessages].sort(compareMessages));
      for (const attempt of consumer.attempts) {
        expect(attempt).toMatchObject({
          attempts: 1,
          userId: account.id,
          ackCalls: 1,
          retryCalls: 0,
          complete: true,
          errors: [],
          calendar: expectedCalendar === "absent" ? null : expect.any(String),
        });
        if (expectedCalendar === "absent") continue;
        const calendar = JSON.parse(attempt.calendar as string);
        expect(calendar).toMatchObject({
          version: 2,
          text: expect.any(String),
        });
        expect(calendar.text).toContain("BEGIN:VCALENDAR");
        expect(calendar.text).toContain("END:VCALENDAR");
      }
      if (expectedCalendar === "absent") expect(consumer.calendar).toBeNull();
      if (consumedMessages.length)
        expect(
          consumer.attempts.some(
            (attempt) => attempt.calendar === consumer.calendar,
          ),
        ).toBe(true);
    },
  };
}
