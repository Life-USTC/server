import { makeSignature } from "better-auth/crypto";
import { expect } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { getOAuthRestAudienceUrls } from "@/lib/oauth/resource-urls";
import { restStateTest } from "../shared/rest-state-contract-fixture";

const test = restStateTest.extend(
  "reader",
  async ({ rest: { db, origin, fetch }, protocolRuntime }) =>
    protocolRuntime.run(async () => {
      const scopes = [
        "workspace.todo:read",
        "workspace.overview:read",
        "workspace.calendar:read",
      ];
      const clientId = `native-reader-${crypto.randomUUID()}`;
      await db.oAuthClient.create({
        data: {
          clientId,
          name: "Native reader",
          scopes,
          redirectUris: ["https://client.example/callback"],
        },
      });
      async function actor() {
        const user = await db.user.create({
          data: {
            email: `${crypto.randomUUID()}@native-reader.test`,
            name: "Native reader",
          },
        });
        const consent = await db.oAuthConsent.create({
          data: { userId: user.id, clientId, scopes },
        });
        const sessionToken = crypto.randomUUID();
        await db.session.create({
          data: {
            userId: user.id,
            sessionToken,
            expires: new Date(Date.now() + 3600_000),
          },
        });
        const context = await getBetterAuthInstance().$context;
        const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${sessionToken}.${await makeSignature(sessionToken, context.secret)}`)}`;
        return { id: user.id, consent, cookie };
      }
      const owner = await actor();
      const other = await actor();
      async function bearer(actor = owner, acceptedScopes = scopes) {
        const issuedAt = Math.floor(Date.now() / 1000);
        const token = await signResourceBoundOAuthAccessToken({
          clientId,
          userId: actor.id,
          grantId: actor.consent.grantId,
          scopes: acceptedScopes,
          resources: getOAuthRestAudienceUrls(),
          issuedAt,
          expiresAt: issuedAt + 300,
        });
        if (!token) throw new Error("Expected signed OAuth access token");
        return `Bearer ${token}`;
      }
      async function read(path: string, headers?: Record<string, string>) {
        const response = await fetch(`${origin}${path}`, {
          headers: headers ?? { authorization: await bearer() },
        });
        expect(response.status).toBe(200);
        return response.json();
      }
      return { owner, other, bearer, read };
    }),
);

const atTime = "2035-09-15T10:30:00+08:00";
const overviewPath = `/api/workspace/overview/actionable?atTime=${encodeURIComponent(atTime)}&locale=zh-cn`;

test(
  "todo.rest-complete-pagination",
  { tags: ["@Todo/REST"] },
  async ({ reader: r, rest: { db, origin, fetch }, protocolRuntime }) =>
    protocolRuntime.run(async () => {
      const expected = Array.from(
        { length: 205 },
        (_, i) => `native-todo-${String(i).padStart(3, "0")}`,
      );
      await db.todo.createMany({
        data: expected.map((id) => ({
          id,
          userId: r.owner.id,
          title: id,
          dueAt: new Date("2035-09-16T12:00:00+08:00"),
          createdAt: new Date("2035-09-01"),
        })),
      });
      await db.todo.createMany({
        data: [
          { userId: r.owner.id, title: "Completed history", completed: true },
          { userId: r.other.id, title: "Foreign secret" },
        ],
      });
      const legacy = await r.read("/api/workspace/todos", {
        cookie: r.owner.cookie,
      });
      expect(legacy.todos).toHaveLength(100);
      expect(legacy.pagination).toBeUndefined();
      const maximum = await r.read("/api/workspace/todos?limit=200");
      expect(maximum.todos).toHaveLength(200);
      const ids: string[] = [];
      for (const page of [1, 2, 3, 4]) {
        const body = await r.read(
          `/api/workspace/todos?completed=false&page=${page}&pageSize=100`,
        );
        expect(body.pagination).toEqual({
          page,
          pageSize: 100,
          total: 205,
          totalPages: 3,
        });
        expect(Object.keys(body).sort()).toEqual([
          "data",
          "meta",
          "pagination",
        ]);
        expect(body.meta.counts).toMatchObject({
          completed: 1,
          incomplete: 205,
        });
        ids.push(...body.data.map((row: { id: string }) => row.id));
        if (page === 4) expect(body.data).toEqual([]);
      }
      expect(ids).toEqual(expected);
      const defaultPage = await r.read("/api/workspace/todos?page=1");
      expect(defaultPage.pagination.pageSize).toBe(20);
      const foreign = await r.read("/api/workspace/todos?page=1", {
        authorization: await r.bearer(r.other),
      });
      expect(foreign.data.map((row: { title: string }) => row.title)).toEqual([
        "Foreign secret",
      ]);
      for (const query of [
        "limit=1&page=1",
        "limit=1&pageSize=20",
        "page=0",
        "page=100001",
        "page=1.5",
        "pageSize=0",
        "pageSize=101",
      ]) {
        const response = await fetch(`${origin}/api/workspace/todos?${query}`, {
          headers: { authorization: await r.bearer() },
        });
        expect(response.status).toBe(400);
      }
    }),
);

test(
  "overview.native-actionable-projection",
  { tags: ["@Overview/REST"] },
  async ({ reader: r, rest: { db }, protocolRuntime }) =>
    protocolRuntime.run(async () => {
      const [historical, current] = await db.section.findMany({
        orderBy: { id: "asc" },
      });
      await db.semester.update({
        where: { id: (await db.semester.findFirstOrThrow()).id },
        data: {
          startDate: new Date("2034-09-01"),
          endDate: new Date("2035-01-31"),
        },
      });
      const semester = await db.semester.create({
        data: {
          jwId: 1_999_999_999,
          code: "2035-fall",
          nameCn: "2035秋",
          startDate: new Date("2035-09-01"),
          endDate: new Date("2036-01-31"),
        },
      });
      await db.section.update({
        where: { id: current.id },
        data: { semesterId: semester.id },
      });
      await db.userSectionSubscription.create({
        data: {
          userId: r.owner.id,
          sectionId: historical.id,
          kind: "teaching_assistant",
        },
      });
      const group = await db.scheduleGroup.create({
        data: {
          sectionId: historical.id,
          jwId: historical.jwId,
          no: 1,
          limitCount: 1,
          stdCount: 1,
          actualPeriods: 2,
          isDefault: true,
        },
      });
      const teacher = await db.teacher.findFirstOrThrow();
      const course = await db.course.findUniqueOrThrow({
        where: { id: historical.courseId },
      });
      const schedule = await db.schedule.create({
        data: {
          sectionId: historical.id,
          scheduleGroupId: group.id,
          date: new Date("2035-09-15"),
          weekday: 6,
          startTime: 1000,
          endTime: 1100,
          periods: 2,
          weekIndex: 1,
          startUnit: 1,
          endUnit: 2,
          customPlace: "Native Lab",
          teacherParticipations: { create: { teacherId: teacher.id } },
        },
      });
      const exam = await db.exam.create({
        data: {
          jwId: historical.jwId,
          sectionId: historical.id,
          examDate: new Date("2035-09-16"),
          startTime: null,
          endTime: null,
          examMode: "闭卷",
          examRooms: { create: { room: "Exam Lab", count: 20 } },
        },
      });
      await db.homework.createMany({
        data: [
          {
            id: "ta-past",
            sectionId: historical.id,
            title: "Past TA",
            submissionDueAt: new Date("2035-09-15T10:29:59+08:00"),
          },
          {
            id: "ta-exact",
            sectionId: historical.id,
            title: "Exact TA",
            submissionDueAt: new Date(atTime),
          },
          {
            id: "ta-future",
            sectionId: historical.id,
            title: "Future TA",
            submissionDueAt: new Date("2035-09-16T00:00:00+08:00"),
          },
          { id: "ta-undated", sectionId: historical.id, title: "Undated TA" },
          {
            id: "ta-complete",
            sectionId: historical.id,
            title: "Done TA",
            submissionDueAt: new Date("2035-09-17T12:00:00+08:00"),
          },
          {
            id: "unsubscribed",
            sectionId: current.id,
            title: "Unsubscribed homework",
          },
        ],
      });
      await db.homeworkCompletion.create({
        data: { userId: r.owner.id, homeworkId: "ta-complete" },
      });
      await db.todo.createMany({
        data: [
          {
            id: "owner-overdue",
            userId: r.owner.id,
            title: "Yesterday",
            dueAt: new Date("2035-09-14T23:59:59+08:00"),
          },
          {
            id: "owner-today",
            userId: r.owner.id,
            title: "Today",
            dueAt: new Date("2035-09-15T10:00:00+08:00"),
            priority: "high",
            content: "Action detail",
          },
          {
            id: "owner-three",
            userId: r.owner.id,
            title: "Third day",
            dueAt: new Date("2035-09-18T23:59:59+08:00"),
          },
          {
            id: "owner-four",
            userId: r.owner.id,
            title: "Fourth day",
            dueAt: new Date("2035-09-19T00:00:00+08:00"),
          },
          { id: "owner-undated", userId: r.owner.id, title: "Undated todo" },
          {
            id: "owner-done",
            userId: r.owner.id,
            title: "Done todo",
            completed: true,
          },
          { id: "foreign", userId: r.other.id, title: "Foreign private todo" },
        ],
      });
      await db.youngEvent.create({
        data: {
          youngId: "native-activity",
          name: "Workshop",
          isActive: true,
          rawJson: {},
          startAt: new Date("2035-09-15T14:00:00+08:00"),
          endAt: new Date("2035-09-15T16:00:00+08:00"),
          location: "Activity Lab",
        },
      });
      await db.userYoungEventSubscription.create({
        data: {
          userId: r.owner.id,
          youngId: "native-activity",
          observedState: "[]",
        },
      });
      const body = await r.read(overviewPath);
      expect(body.anchor).toEqual({
        atTime,
        dateFrom: "2035-09-15T00:00:00+08:00",
        dateTo: "2035-09-22T00:00:00+08:00",
      });
      expect(body.focus).toMatchObject({
        id: `schedule-${schedule.id}-2035-09-15T10:00:00+08:00`,
        status: "now",
        target: { kind: "section", id: String(historical.jwId) },
        subscriptionKind: "teaching_assistant",
        location: "Native Lab",
        teachers: [teacher.nameCn],
      });
      const names = (rows: Array<{ title: string }>) =>
        rows.map(({ title }) => title);
      expect(names(body.urgency)).toEqual(["Yesterday", "Today"]);
      expect(names(body.deadlines.today)).toEqual(["Today"]);
      expect(names(body.deadlines.nextThreeDays)).toEqual([
        "Future TA",
        "Third day",
      ]);
      expect(names(body.deadlines.allPending)).toEqual([
        "Yesterday",
        "Today",
        "Future TA",
        "Third day",
        "Fourth day",
        "Undated TA",
        "Undated todo",
      ]);
      expect(body.deadlines.today[0]).toMatchObject({
        priority: "high",
        content: "Action detail",
        target: { kind: "todo", id: "owner-today" },
      });
      expect(
        body.upcoming.find((row: { type: string }) => row.type === "exam"),
      ).toMatchObject({
        hasTime: false,
        target: { kind: "exam", id: String(exam.id) },
        location: "Exam Lab",
        examMode: "闭卷",
      });
      expect(
        body.upcoming.find(
          (row: { type: string }) => row.type === "young_event",
        ),
      ).toMatchObject({
        target: { kind: "young_event", id: "native-activity" },
      });
      expect(body.subscriptions).toMatchObject({
        totalCount: 1,
        currentSemesterCount: 0,
        currentSemester: { id: semester.id },
      });
      expect(Object.keys(body).sort()).toEqual([
        "anchor",
        "deadlines",
        "focus",
        "subscriptions",
        "upcoming",
        "urgency",
      ]);
      expect(JSON.stringify(body)).not.toMatch(
        /calendarFeed|subscriptionUrl|Foreign private|Done TA|Past TA|Exact TA|Unsubscribed homework/,
      );
      const english = await r.read(overviewPath.replace("zh-cn", "en-us"));
      expect(english.focus).toMatchObject({
        title: course.nameEn,
        teachers: [teacher.nameEn],
        location: "Native Lab",
        sectionCode: historical.code,
      });
      expect(
        english.upcoming.find((row: { type: string }) => row.type === "exam"),
      ).toMatchObject({ title: course.nameEn, examMode: "闭卷" });
      const other = await r.read(overviewPath, {
        authorization: await r.bearer(r.other),
      });
      expect(names(other.deadlines.allPending)).toEqual([
        "Foreign private todo",
      ]);
      expect(other.focus).toBeNull();
    }),
);

test(
  "overview.native-read-authorization",
  { tags: ["@Overview/REST"] },
  async ({ reader: r, rest: { origin, fetch }, protocolRuntime }) =>
    protocolRuntime.run(async () => {
      for (const authorization of [
        undefined,
        "Bearer",
        "Bearer invalid",
        await r.bearer(r.owner, ["workspace.todo:read"]),
      ]) {
        const response = await fetch(`${origin}${overviewPath}`, {
          headers: authorization
            ? { authorization, cookie: r.owner.cookie }
            : {},
        });
        expect(response.status).toBe(401);
      }
      const cookie = await r.read(overviewPath, { cookie: r.owner.cookie });
      expect(cookie.deadlines.allPending).toEqual([]);
      const scoped = await fetch(`${origin}${overviewPath}`, {
        headers: {
          authorization: await r.bearer(r.owner, ["workspace.overview:read"]),
        },
      });
      expect(scoped.status).toBe(200);
      expect(scoped.headers.get("cache-control")).toBe("private, no-store");
      const invalid = await fetch(
        `${origin}/api/workspace/overview/actionable?atTime=invalid`,
        { headers: { authorization: await r.bearer() } },
      );
      expect(invalid.status).toBe(400);
    }),
);

test(
  "calendar.native-navigation-context",
  { tags: ["@Calendar/REST"] },
  async ({ reader: r, rest: { db }, protocolRuntime }) =>
    protocolRuntime.run(async () => {
      const section = await db.section.findFirstOrThrow();
      const teacher = await db.teacher.findFirstOrThrow();
      const course = await db.course.findUniqueOrThrow({
        where: { id: section.courseId },
      });
      const room = await db.room.create({
        data: {
          jwId: section.jwId,
          code: "native-lecture-room",
          nameCn: "原生教室",
          nameEn: "Native Lecture Room",
          virtual: false,
          seats: 30,
          seatsForSection: 30,
        },
      });
      await db.userSectionSubscription.create({
        data: { userId: r.owner.id, sectionId: section.id, kind: "auditor" },
      });
      const group = await db.scheduleGroup.create({
        data: {
          sectionId: section.id,
          jwId: section.jwId,
          no: 1,
          limitCount: 1,
          stdCount: 1,
          actualPeriods: 2,
          isDefault: true,
        },
      });
      const schedule = await db.schedule.create({
        data: {
          sectionId: section.id,
          scheduleGroupId: group.id,
          date: new Date("2035-09-15"),
          weekday: 6,
          startTime: 1000,
          endTime: 1100,
          periods: 2,
          weekIndex: 1,
          startUnit: 1,
          endUnit: 2,
          customPlace: "Custom room",
          roomId: room.id,
          teacherParticipations: { create: { teacherId: teacher.id } },
        },
      });
      await db.exam.create({
        data: {
          jwId: section.jwId,
          sectionId: section.id,
          examDate: new Date("2035-09-15"),
          startTime: null,
          examRooms: { create: { room: "Room A", count: 30 } },
        },
      });
      await db.homework.create({
        data: {
          id: "calendar-hw",
          sectionId: section.id,
          title: "Homework",
          submissionDueAt: new Date("2035-09-15T12:00:00+08:00"),
        },
      });
      await db.todo.create({
        data: {
          id: "calendar-todo",
          userId: r.owner.id,
          title: "Todo",
          priority: "low",
          content: "Read chapter",
          dueAt: new Date("2035-09-15T12:00:00+08:00"),
        },
      });
      await db.youngEvent.create({
        data: {
          youngId: "calendar-young",
          name: "Workshop",
          isActive: true,
          rawJson: {},
          startAt: new Date("2035-09-15T14:00:00+08:00"),
          endAt: new Date("2035-09-15T16:00:00+08:00"),
        },
      });
      await db.userYoungEventSubscription.create({
        data: {
          userId: r.owner.id,
          youngId: "calendar-young",
          observedState: "[]",
        },
      });
      const result = await r.read(
        "/api/workspace/calendar/events?dateFrom=2035-09-15&dateTo=2035-09-15&pageSize=100&locale=zh-cn",
      );
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 100,
        total: 5,
        totalPages: 1,
      });
      const rows = Object.fromEntries(
        result.data.map((row: { type: string }) => [row.type, row]),
      );
      expect(rows.schedule).toMatchObject({
        conflictIntervals: [
          {
            startAt: "2035-09-15T10:00:00+08:00",
            endAt: "2035-09-15T11:00:00+08:00",
          },
        ],
        location: "Custom room",
        teachers: [teacher.nameCn],
        sectionCode: section.code,
        subscriptionKind: "auditor",
        target: { kind: "section", id: String(section.jwId) },
      });
      expect(rows.exam).toMatchObject({
        hasTime: false,
        conflictIntervals: [],
        location: "Room A",
        subscriptionKind: "auditor",
        target: { kind: "exam", id: expect.any(String) },
      });
      expect(rows.homework_due).toMatchObject({
        target: { kind: "homework", id: "calendar-hw" },
        completionRequired: true,
        subscriptionKind: "auditor",
      });
      expect(rows.todo_due).toMatchObject({
        target: { kind: "todo", id: "calendar-todo" },
        priority: "low",
        content: "Read chapter",
      });
      expect(rows.young_event).toMatchObject({
        conflictIntervals: [],
        target: { kind: "young_event", id: "calendar-young" },
        location: null,
      });
      expect(Object.keys(rows.schedule).sort()).toEqual([
        "at",
        "completionRequired",
        "conflictIntervals",
        "content",
        "endsAt",
        "examMode",
        "hasTime",
        "id",
        "location",
        "priority",
        "sectionCode",
        "sectionJwId",
        "subscriptionKind",
        "target",
        "teachers",
        "title",
        "type",
        "url",
        "youngId",
      ]);
      expect(JSON.stringify(result)).not.toContain(teacher.email);
      const englishPath =
        "/api/workspace/calendar/events?dateFrom=2035-09-15&dateTo=2035-09-15&pageSize=100";
      const englishHeaders = {
        authorization: await r.bearer(),
        "accept-language": "en-US,en;q=0.9",
      };
      const english = await r.read(englishPath, englishHeaders);
      expect(
        english.data.find((row: { type: string }) => row.type === "schedule"),
      ).toMatchObject({
        title: course.nameEn,
        teachers: [teacher.nameEn],
        location: "Custom room",
        sectionCode: section.code,
      });
      expect(
        english.data.find((row: { type: string }) => row.type === "exam"),
      ).toMatchObject({
        title: course.nameEn,
        location: "Room A",
      });
      await db.schedule.update({
        where: { id: schedule.id },
        data: { customPlace: null },
      });
      const roomFallback = await r.read(englishPath, englishHeaders);
      expect(
        roomFallback.data.find(
          (row: { type: string }) => row.type === "schedule",
        ),
      ).toMatchObject({
        location: "Native Lecture Room",
      });
    }),
);
