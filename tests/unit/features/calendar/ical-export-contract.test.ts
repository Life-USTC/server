import { afterEach, expect, test, vi } from "vitest";
import type {
  CalendarHomework,
  CalendarSection,
} from "@/features/calendar/server/ical-event-types";

const section = {
  jwId: 42,
  code: "EXPORT.01",
  course: { nameCn: "Export course", code: "EXPORT" },
  schedules: [
    {
      id: 101,
      date: new Date("2026-09-11T00:00:00Z"),
      startTime: 800,
      endTime: 945,
      room: {
        code: "3A204",
        nameCn: "3A204",
        building: { nameCn: "三教", campus: { nameCn: "西区" } },
      },
      teacherParticipations: [],
    },
  ],
  exams: [
    {
      id: 102,
      examDate: new Date("2026-09-11T00:00:00Z"),
      startTime: 1400,
      endTime: 1600,
      examType: 2,
      examRooms: [{ room: "3A204" }],
    },
  ],
} as unknown as CalendarSection;
const homework = {
  id: "homework-export",
  title: "Homework",
  submissionDueAt: new Date("2026-09-11T10:00:00Z"),
  description: { content: "Deadline" },
  section,
} as unknown as CalendarHomework;

async function exports() {
  const {
    createSectionCalendar,
    createMultiSectionCalendar,
    createUserCalendar,
  } = await import("@/features/calendar/server/ical");
  return Promise.all([
    createSectionCalendar(section),
    createMultiSectionCalendar([section]),
    createUserCalendar({
      sections: [section],
      homeworks: [homework],
      todos: [
        {
          id: "todo-export",
          title: "Todo",
          content: "Personal",
          dueAt: new Date("2026-09-11T11:00:00Z"),
          priority: "medium",
        },
      ],
      youngEvents: [
        {
          youngId: "young-export",
          name: "Young",
          startAt: new Date("2026-09-11T12:00:00Z"),
          endAt: new Date("2026-09-11T13:00:00Z"),
          location: "3A204",
          sourceMissing: false,
          lastSeenAt: null,
        },
      ],
    }),
  ]);
}

function validMetadata(url: string) {
  if (url.endsWith("geo_data.json"))
    return { locations: [{ name: "3A204", latitude: 31.8, longitude: 117.2 }] };
  if (url.endsWith("building_img_rules.json"))
    return [{ regex: "3A204", path: "./imgs/building.png" }];
  return { rooms: [] };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
});

test("ical.static-json-resilient", async () => {
  for (const variant of [
    "unavailable",
    "non-json",
    "wrong-root",
    "wrong-fields",
    "valid",
  ] as const) {
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (variant === "unavailable")
          throw new Error("Optional asset unavailable");
        if (variant === "non-json")
          return new Response("<html>unavailable</html>");
        if (variant === "wrong-root") return Response.json({});
        if (variant === "wrong-fields")
          return Response.json(
            url.endsWith("geo_data.json")
              ? { locations: [{ name: 4, latitude: "bad", longitude: null }] }
              : [{ regex: 4, path: null }],
          );
        return Response.json(validMetadata(url));
      }),
    );
    for (const [index, calendar] of (await exports()).entries()) {
      const output = calendar.toString().replace(/\r\n[ \t]/g, "");
      expect(output).toContain("BEGIN:VCALENDAR");
      expect(output).toContain("END:VCALENDAR");
      expect(calendar.events()).toHaveLength(index === 2 ? 5 : 2);
      expect(output).toContain("/schedule/101");
      expect(output).toContain("/exam/102");
      if (index === 2)
        for (const id of [
          "/homework/homework-export",
          "/todo/todo-export",
          "young-young-export@life-ustc",
        ])
          expect(output).toContain(id);
      if (variant === "valid") {
        expect(output).toContain("GEO:31.8;117.2");
        expect(output).toContain(
          "ATTACH:https://static.life-ustc.tiankaima.dev/imgs/building.png",
        );
      } else {
        expect(output).not.toContain("GEO:");
        expect(output).not.toContain("ATTACH:");
      }
    }
  }
});

test("ical.rfc5545-dtstamp-utc", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-01T15:09:41Z"));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) =>
      Response.json(validMetadata(String(input))),
    ),
  );
  for (const [index, calendar] of (await exports()).entries()) {
    const output = calendar.toString();
    const events = output.split("BEGIN:VEVENT\r\n").slice(1);
    expect(events).toHaveLength(index === 2 ? 5 : 2);
    expect(output).toContain("TZID:Asia/Shanghai");
    for (const event of events) {
      expect(event.match(/^DTSTAMP:.*$/gm)).toEqual([
        "DTSTAMP:20260901T150941Z",
      ]);
      expect(event).toMatch(/^DTSTART;TZID=Asia\/Shanghai:20260911T\d{6}$/m);
      expect(event).toMatch(/^DTEND;TZID=Asia\/Shanghai:20260911T\d{6}$/m);
    }
    expect(events[0]).toContain("DTSTART;TZID=Asia/Shanghai:20260911T080000");
    expect(events[0]).toContain("DTEND;TZID=Asia/Shanghai:20260911T094500");
    if (index === 2) {
      expect(events[2]).toContain("DTSTART;TZID=Asia/Shanghai:20260911T180000");
      expect(events[3]).toContain("DTSTART;TZID=Asia/Shanghai:20260911T190000");
      expect(events[4]).toContain("DTSTART;TZID=Asia/Shanghai:20260911T200000");
      expect(events[4]).toContain("DTEND;TZID=Asia/Shanghai:20260911T210000");
    }
  }
});

test("Young calendar timestamps cross midnight in Shanghai independently of the host timezone", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) =>
      Response.json(validMetadata(String(input))),
    ),
  );
  const { createUserCalendar } = await import(
    "@/features/calendar/server/ical"
  );
  const calendar = await createUserCalendar({
    sections: [],
    homeworks: [],
    todos: [],
    youngEvents: [
      {
        youngId: "midnight",
        name: "After midnight",
        startAt: new Date("2026-09-11T16:30:00Z"),
        endAt: new Date("2026-09-11T18:00:00Z"),
        location: null,
        sourceMissing: false,
        lastSeenAt: null,
      },
    ],
  });
  const output = calendar.toString();
  expect(output).toContain("DTSTART;TZID=Asia/Shanghai:20260912T003000");
  expect(output).toContain("DTEND;TZID=Asia/Shanghai:20260912T020000");
});
