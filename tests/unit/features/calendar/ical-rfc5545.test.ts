import { describe, expect, test } from "vitest";
import { Rfc5545Calendar } from "@/features/calendar/server/ical";
import { APP_TIME_ZONE } from "@/lib/time/parse-date-input";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

describe("RFC 5545 calendar serialization", () => {
  test("serializes each DTSTAMP in UTC without changing event time zones", () => {
    const calendar = new Rfc5545Calendar({
      timezone: {
        name: APP_TIME_ZONE,
        generator: () =>
          ["BEGIN:VTIMEZONE", `TZID:${APP_TIME_ZONE}`, "END:VTIMEZONE"].join(
            "\r\n",
          ),
      },
    });
    const stamps = [
      new Date("2026-07-13T15:09:41.000Z"),
      new Date("2026-07-13T16:10:42.000Z"),
    ];

    for (const [index, stamp] of stamps.entries()) {
      calendar.createEvent({
        id: `event-${index}`,
        stamp,
        start: shanghaiDayjs(stamp),
        timezone: APP_TIME_ZONE,
        summary: `Event ${index}`,
      });
    }

    const output = calendar.toString();
    const dtstamps = [...output.matchAll(/^DTSTAMP:([^\r\n]+)$/gm)].map(
      (match) => match[1],
    );

    expect(dtstamps).toEqual(["20260713T150941Z", "20260713T161042Z"]);
    expect(output).toContain("BEGIN:VTIMEZONE");
    expect(output).toContain(`DTSTART;TZID=${APP_TIME_ZONE}:20260713T230941`);
  });
});
