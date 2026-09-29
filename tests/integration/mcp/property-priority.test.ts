import { expect, vi } from "vitest";
import { createCatalogContractFixture } from "../../shared/catalog-contract-fixture";
import { isolatedMcpTest } from "./_harness/isolated-context";

const contractTest = isolatedMcpTest.extend(
  "state",
  async ({ isolatedDatabase, mcpSessions, mcpBus }) => {
    const db = isolatedDatabase.owner;
    const deletedKeys = new Set<string>();
    const userId = crypto.randomUUID();
    const userName = `Projection ${userId.slice(0, 8)}`;
    const username = `projection${userId.slice(0, 8)}`;
    const date = new Date().toLocaleDateString("sv-SE", {
      timeZone: "Asia/Shanghai",
    });
    const atTime = `${date}T07:00:00+08:00`;
    const dueAt = `${date}T18:00:00+08:00`;
    const youngId = `projection-${crypto.randomUUID()}`;
    const session = mcpSessions.own(userId);
    const client = session.client;
    async function invoke(
      name: string,
      args: Row,
      expected: Row,
      mode: "default" | "full" = "default",
    ) {
      const result = await external.storage.run(deletedKeys, () =>
        client.call(name, { ...args, mode }),
      );
      expect(result.success, `${name}: ${JSON.stringify(result)}`).not.toBe(
        false,
      );
      expect(result.found, name).not.toBe(false);
      const fields = projectionFields[name];
      const view = fields && {
        visible: fields[0].split(" ").filter(Boolean),
        full: fields[1].split(" ").filter(Boolean),
      };
      expect(view, name).toBeDefined();
      if (!view) throw new Error(`Missing declaration for ${name}`);
      for (const path of [
        ...view.visible,
        ...(mode === "full" ? view.full : []),
      ]) {
        const actual = values(result, path.split("."));
        expect(
          actual.length,
          `${name}.${path} has populated records`,
        ).toBeGreaterThan(0);
        expect(actual, `${name}.${path} exists`).not.toContain(undefined);
      }
      for (const [path, expectedValue] of Object.entries(expected))
        expect(
          values(result, path.split(".")),
          `${name}.${path}`,
        ).toContainEqual(expectedValue);
      expect(JSON.stringify(result), name).not.toContain(`secret-${userId}`);
      return result;
    }
    async function pair(name: string, args: Row, expected: Row) {
      const compact = await invoke(name, args, expected);
      const full = await invoke(name, args, expected, "full");
      const fields = projectionFields[name];
      const view = fields && {
        visible: fields[0].split(" ").filter(Boolean),
        full: fields[1].split(" ").filter(Boolean),
      };
      if (!view) throw new Error(`Missing declaration for ${name}`);
      for (const path of view.visible) {
        const a = values(compact, path.split("."));
        const b = values(full, path.split("."));
        expect(
          isProjection(a, b),
          `${name}.${path}: compact preserves values`,
        ).toBe(true);
      }
      return { compact, full };
    }
    const catalog = await createCatalogContractFixture(db);
    const records = await db.$transaction(async (db) => {
      const year = Number(date.slice(0, 4));
      const currentSemesterId = (
        await db.semester.update({
          where: { id: catalog.semester.id },
          data: {
            startDate: new Date(`${year}-01-01T00:00:00.000Z`),
            endDate: new Date(`${year}-12-31T00:00:00.000Z`),
          },
        })
      ).id;
      const campus = await db.campus.create({
        data: {
          jwId: catalog.base,
          code: catalog.marker,
          nameCn: `校区${catalog.marker}`,
          nameEn: `Campus ${catalog.marker}`,
        },
      });
      const campusId = campus.id;
      await db.section.updateMany({
        where: { id: { in: catalog.sections.map((s) => s.id) } },
        data: { campusId, semesterId: currentSemesterId },
      });
      await db.user.create({
        data: {
          id: userId,
          name: userName,
          username,
          email: `${userId}@example.test`,
          image: "https://example.test/projection.png",
          calendarFeedToken: `secret-${userId}`,
        },
      });
      await db.userSectionSubscription.create({
        data: { userId, sectionId: catalog.sections[0].id },
      });
      const group = await db.scheduleGroup.create({
        data: {
          jwId: catalog.base,
          sectionId: catalog.sections[0].id,
          no: 1,
          limitCount: 20,
          stdCount: 10,
          actualPeriods: 2,
          isDefault: true,
        },
      });
      const scheduleId = (
        await db.schedule.create({
          data: {
            sectionId: catalog.sections[0].id,
            scheduleGroupId: group.id,
            date: new Date(date),
            weekday: new Date(date).getUTCDay() || 7,
            startTime: 800,
            endTime: 935,
            periods: 2,
            weekIndex: 1,
            startUnit: 1,
            endUnit: 2,
            customPlace: "Projection classroom",
            teacherParticipations: {
              create: {
                teacherId: catalog.teachers[0].id,
                periods: 2,
                exerciseClass: false,
              },
            },
          },
        })
      ).id;
      const batchId = (
        await db.examBatch.create({
          data: {
            jwId: catalog.base,
            nameCn: "契约考试批次",
            nameEn: "Projection exam batch",
          },
        })
      ).id;
      await db.exam.create({
        data: {
          jwId: catalog.base,
          sectionId: catalog.sections[0].id,
          examBatchId: batchId,
          examDate: new Date(date),
          startTime: 1400,
          endTime: 1600,
          examMode: "闭卷",
          examRooms: { create: { room: "Projection exam room", count: 12 } },
        },
      });
      const homeworkId = (
        await db.homework.create({
          data: {
            title: "Projection homework",
            sectionId: catalog.sections[0].id,
            createdById: userId,
            publishedAt: new Date(atTime),
            submissionDueAt: new Date(dueAt),
            isMajor: true,
            requiresTeam: true,
            description: {
              create: {
                content: "Projection homework **Markdown**",
                lastEditedById: userId,
                lastEditedAt: new Date(atTime),
              },
            },
          },
        })
      ).id;
      const todoId = (
        await db.todo.create({
          data: {
            userId,
            title: "Projection todo",
            content: "Projection todo details",
            priority: "high",
            dueAt: new Date(dueAt),
          },
        })
      ).id;
      const uploadId = (
        await db.upload.create({
          data: {
            userId,
            key: `uploads/${userId}/projection.txt`,
            filename: "projection.txt",
            contentType: "text/plain",
            size: 321,
          },
        })
      ).id;
      const organizerId = (
        await db.youngOrganizer.create({
          data: {
            name: `Projection organizer ${catalog.marker}`,
            normalizedName: catalog.marker,
          },
        })
      ).id;
      await db.youngEvent.create({
        data: {
          youngId,
          name: `Projection event ${catalog.marker}`,
          organizerId,
          startAt: new Date(dueAt),
          endAt: new Date(`${date}T20:00:00+08:00`),
          location: "Projection event room",
          category: "学术",
          module: "智",
          form: "讲座",
          activityLevel: "校级",
          status: "报名中",
          isActive: true,
          rawJson: { rawMarker: "raw-young-projection" },
          description: "Projection event description",
          applyStartAt: new Date(atTime),
          applyEndAt: new Date(dueAt),
        },
      });
      const comment = await db.comment.create({
        data: {
          userId,
          sectionId: catalog.sections[0].id,
          body: "Projection comment **Markdown**",
        },
      });
      const commentId = comment.id;
      await db.comment.create({
        data: {
          userId,
          sectionId: catalog.sections[0].id,
          parentId: commentId,
          rootId: commentId,
          body: "Projection reply",
        },
      });
      await db.description.create({
        data: {
          courseId: catalog.courses[0].id,
          content: "Projection course **Markdown**",
          lastEditedById: userId,
          lastEditedAt: new Date(atTime),
        },
      });
      await db.busUserPreference.create({
        data: {
          userId,
          preferredOriginCampusId: mcpBus.originCampusId,
          preferredDestinationCampusId: mcpBus.destinationCampusId,
          showDepartedTrips: true,
        },
      });

      return {
        userId,
        userName,
        username,
        date,
        atTime,
        dueAt,
        youngId,
        catalog,
        client,
        homeworkId,
        todoId,
        commentId,
        uploadId,
        organizerId,
        campusId,
        batchId,
        scheduleId,
        currentSemesterId,
      };
    });
    await session.initialize();
    return { ...records, db, mcpBus, deletedKeys, invoke, pair };
  },
);

// The mocked SDK storage observer belongs to the current invocation, never a
// process-wide history. Real R2 effects are covered by Worker tests.
const external = await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  return { storage: new AsyncLocalStorage<Set<string>>() };
});
vi.mock("@/lib/storage/r2-object", async (original) => ({
  ...(await original<object>()),
  deleteStorageObject: async (key: string) => {
    const deletedKeys = external.storage.getStore();
    if (!deletedKeys)
      throw new Error("Storage invocation has no private observer");
    deletedKeys.add(key);
  },
}));
vi.mock("@/features/weather/server/weather-cache", () => ({
  readWeatherCache: async (key: string) => ({
    location: { key, name: "Projection weather", adcode: "340100" },
    fetchedAt: new Date().toISOString(),
    providers: ["amap"],
    current: { temperature: 23, condition: { text: "晴", icon: "sunny" } },
    hourly: [],
    daily: [],
    alerts: [],
    extensions: { amap: { privateMarker: "raw-weather-projection" } },
  }),
}));

type Row = Record<string, unknown>;
function values(value: unknown, path: string[]): unknown[] {
  if (path.length === 0) return [value];
  if (Array.isArray(value)) return value.flatMap((item) => values(item, path));
  if (value === null) return [null];
  if (!value || typeof value !== "object") return [undefined];
  return values((value as Row)[path[0]], path.slice(1));
}
function isProjection(compact: unknown, full: unknown): boolean {
  if (Array.isArray(compact))
    return (
      Array.isArray(full) &&
      compact.length === full.length &&
      compact.every((v, i) => isProjection(v, full[i]))
    );
  if (compact && typeof compact === "object")
    return Boolean(
      full &&
        typeof full === "object" &&
        Object.entries(compact).every(([key, value]) =>
          isProjection(value, (full as Row)[key]),
        ),
    );
  return compact === full;
}
// Explicit protocol projection expectations; maintained by reviewers with the tests.
const projectionFields: Record<string, readonly [string, string]> = {
  catalog_bus_timetable_get: [
    "routes.descriptionPrimary campuses.namePrimary counts notice",
    "",
  ],
  catalog_bus_route_list: [
    "routes.descriptionPrimary routes.id routes.stops",
    "",
  ],
  catalog_bus_route_get: [
    "route.descriptionPrimary route.id route.stops weekday saturday sunday",
    "",
  ],
  workspace_bus_preferences_get: [
    "preference.preferredOriginCampusId preference.preferredDestinationCampusId preference.showDepartedTrips",
    "",
  ],
  workspace_bus_preferences_set: [
    "preference.preferredOriginCampusId preference.preferredDestinationCampusId preference.showDepartedTrips",
    "",
  ],
  catalog_bus_route_search: [
    "routes.descriptionPrimary originCampus.nameCn destinationCampus.nameCn routes.id",
    "",
  ],
  catalog_bus_departure_next: [
    "departures.departureTime departures.arrivalTime departures.minutesUntilDeparture departures.route.descriptionPrimary originCampus.nameCn destinationCampus.nameCn",
    "",
  ],
  workspace_calendar_event_list: [
    "events.at events.endsAt events.type events.payload",
    "",
  ],
  workspace_calendar_timeline_get: [
    "events.at events.endsAt events.type events.payload",
    "",
  ],
  workspace_schedule_list: [
    "schedules.date schedules.startTime schedules.endTime schedules.section.course.nameCn schedules.customPlace schedules.teachers.nameCn schedules.section.code schedules.id",
    "",
  ],
  workspace_exam_list: [
    "exams.examDate exams.startTime exams.endTime exams.section.course.nameCn exams.examMode exams.examRooms exams.section.semester.nameCn exams.id",
    "",
  ],
  catalog_link_list: [
    "links.title links.description links.slug links.group links.icon",
    "",
  ],
  workspace_link_pin_list: ["pinnedSlugs maxPinnedLinks", ""],
  workspace_link_pin_set: ["success", ""],
  community_comment_list: [
    "data.body data.author.name data.createdAt data.id",
    "",
  ],
  community_comment_replies: [
    "thread.body thread.author.name thread.createdAt thread.id",
    "",
  ],
  community_comment_get: [
    "thread.body thread.author.name thread.createdAt thread.id",
    "",
  ],
  community_comment_create: ["id", ""],
  community_comment_update: ["comment.body comment.id", ""],
  community_comment_delete: ["success", ""],
  community_comment_reaction_add: ["changed", ""],
  community_comment_reaction_remove: ["changed", ""],
  catalog_course_search: [
    "data.nameCn data.nameEn data.code data.id data.jwId",
    "",
  ],
  catalog_course_get: [
    "course.nameCn course.nameEn course.code course.id course.jwId",
    "course.sections",
  ],
  community_description_get: [
    "description.content description.id description.lastEditedBy.name description.lastEditedAt",
    "",
  ],
  community_description_set: [
    "description.content description.id description.lastEditedBy.name description.lastEditedAt",
    "",
  ],
  catalog_section_exam_list: [
    "exams.examDate exams.startTime exams.endTime exams.examMode exams.examBatch.namePrimary exams.examRooms exams.id",
    "",
  ],
  workspace_homework_list: [
    "homeworks.title homeworks.submissionDueAt homeworks.id homeworks.isMajor homeworks.requiresTeam homeworks.section.course.nameCn",
    "",
  ],
  community_section_homework_list: [
    "homeworks.title homeworks.submissionDueAt homeworks.id homeworks.isMajor homeworks.requiresTeam homeworks.completionRequired section.code",
    "",
  ],
  community_section_homework_create: [
    "homework.title homework.submissionDueAt homework.id homework.isMajor homework.requiresTeam",
    "",
  ],
  community_section_homework_update: [
    "homework.title homework.submissionDueAt homework.id homework.isMajor homework.requiresTeam",
    "",
  ],
  community_section_homework_delete: ["deletedId alreadyDeleted", ""],
  workspace_homework_completion_set: [
    "completion.completed completion.homeworkId completion.completedAt",
    "",
  ],
  workspace_calendar_feed_get: [
    "subscription.currentSemesterSections.course.namePrimary subscription.currentSemesterSections.code subscription.currentSemesterSections.semester.nameCn subscription.sectionCount",
    "",
  ],
  workspace_overview_get: [
    "overview.pendingHomeworksCount overview.pendingTodosCount overview.upcomingExamsCount overview.todaySchedulesCount samples.dueTodos samples.dueHomeworks samples.upcomingExams",
    "",
  ],
  workspace_snapshot_get: [
    "nextClass currentSemester subscriptions upcomingDeadlines todos bus",
    "",
  ],
  workspace_schedule_next: ["nextClass", ""],
  workspace_deadline_list: [
    "deadlines.at deadlines.type deadlines.payload total",
    "",
  ],
  catalog_schedule_list: [
    "data.date data.startTime data.endTime data.section.course.nameCn data.customPlace data.teachers.nameCn data.section.code data.id",
    "",
  ],
  catalog_section_schedule_list: [
    "schedules.date schedules.startTime schedules.endTime schedules.customPlace schedules.teachers.nameCn schedules.id section.code",
    "",
  ],
  catalog_section_search: [
    "data.course.nameCn data.teachers.nameCn data.code data.semester.nameCn data.campus.nameCn data.jwId",
    "",
  ],
  catalog_section_get: [
    "section.course.nameCn section.teachers.nameCn section.code section.semester.nameCn section.campus.nameCn section.jwId",
    "",
  ],
  catalog_section_calendar_feed_get: [
    "section.course.nameCn section.code section.jwId",
    "",
  ],
  catalog_semester_list: [
    "data.nameCn data.id data.jwId data.code data.startDate data.endDate",
    "",
  ],
  catalog_semester_current: [
    "semester.nameCn semester.id semester.jwId semester.code semester.startDate semester.endDate",
    "",
  ],
  workspace_subscription_list: [
    "sections.course.nameCn sections.teachers.nameCn sections.code sections.semester.nameCn sections.jwId",
    "",
  ],
  catalog_section_match_preview: [
    "sections.course.nameCn sections.teachers.nameCn sections.code sections.semester.nameCn matchedCodes unmatchedCodes",
    "",
  ],
  workspace_subscription_import: [
    "addedCount alreadySubscribedCount matchedCodes unmatchedCodes",
    "",
  ],
  workspace_subscription_kind_update: ["kind sectionJwId", ""],
  catalog_teacher_search: [
    "data.nameCn data.nameEn data.department.nameCn data.teacherTitle.nameCn data.code data.id",
    "",
  ],
  catalog_teacher_get: [
    "teacher.nameCn teacher.nameEn teacher.department.nameCn teacher.teacherTitle.nameCn teacher.id",
    "teacher.email teacher.telephone",
  ],
  workspace_todo_list: [
    "todos.title todos.dueAt todos.completed todos.id todos.priority todos.content",
    "",
  ],
  workspace_todo_create: ["id", ""],
  workspace_todo_update: [
    "todo.title todo.dueAt todo.completed todo.id todo.priority",
    "",
  ],
  workspace_todo_delete: ["success", ""],
  workspace_upload_list: [
    "data.filename data.size data.createdAt data.id meta.usedBytes meta.quotaBytes meta.maxFileSizeBytes",
    "",
  ],
  graphql_operation_run: ["data operationName operationType", ""],
  workspace_upload_rename: ["upload.filename upload.id", ""],
  workspace_upload_delete: ["success", ""],
  account_profile_get: ["name username image id", ""],
  community_user_get: [
    "user.name user.username user.image user.id totalContributions weeks.date weeks.count",
    "",
  ],
  catalog_weather_get: [
    "location.key location.name current.temperature current.condition.text",
    "",
  ],
  catalog_young_event_list: [
    "data.name data.startAt data.endAt data.youngId data.location data.category data.module data.form data.activityLevel data.status",
    "",
  ],
  catalog_young_event_get: [
    "event.name event.startAt event.endAt event.youngId event.location event.category event.module event.form event.activityLevel event.status",
    "",
  ],
  catalog_young_organizer_list: [
    "data.name data.id data.totalCount data.upcomingCount",
    "",
  ],
  catalog_young_organizer_get: [
    "organizer.name organizer.id organizer.totalCount organizer.upcomingCount",
    "",
  ],
};

contractTest(
  "MCP academic catalog preserves explicit compact and full projections",
  async ({ state, expect }) => {
    const { date, catalog, scheduleId, currentSemesterId, pair } = state;

    const course = catalog.courses[0];
    const section = catalog.sections[0];
    const teacher = catalog.teachers[0];
    const sectionArgs = { sectionJwId: section.jwId };
    const range = { dateFrom: date, dateTo: date };
    await pair(
      "catalog_course_search",
      { search: catalog.marker },
      { "data.nameCn": course.nameCn, "data.code": course.code },
    );
    const coursePair = await pair(
      "catalog_course_get",
      { jwId: course.jwId },
      { "course.nameCn": course.nameCn, "course.code": course.code },
    );
    expect(coursePair.compact.course).not.toHaveProperty("sections");
    expect(values(coursePair.full, ["course", "sections", "jwId"])).toContain(
      section.jwId,
    );
    await pair(
      "catalog_teacher_search",
      { search: catalog.marker },
      {
        "data.nameCn": teacher.nameCn,
        "data.department.nameCn": catalog.departments[0].nameCn,
      },
    );
    const teacherPair = await pair(
      "catalog_teacher_get",
      { id: teacher.id },
      {
        "teacher.nameCn": teacher.nameCn,
        "teacher.teacherTitle.nameCn": catalog.titles[0].nameCn,
      },
    );
    expect(teacherPair.compact.teacher).not.toHaveProperty("email");
    expect(teacherPair.full.teacher).toHaveProperty("email", teacher.email);
    await pair(
      "catalog_section_search",
      { jwIds: [section.jwId] },
      {
        "data.course.nameCn": course.nameCn,
        "data.campus.nameCn": `校区${catalog.marker}`,
        "data.teachers.nameCn": teacher.nameCn,
      },
    );
    await pair(
      "catalog_section_get",
      { jwId: section.jwId },
      { "section.course.nameCn": course.nameCn, "section.code": section.code },
    );
    await pair(
      "catalog_section_match_preview",
      { codes: [section.code], semesterId: currentSemesterId },
      { matchedCodes: [section.code], unmatchedCodes: [] },
    );
    await pair(
      "catalog_semester_list",
      { limit: 100 },
      {
        "data.id": catalog.semester.id,
        "data.nameCn": catalog.semester.nameCn,
      },
    );
    await pair(
      "catalog_semester_current",
      {},
      { "semester.id": currentSemesterId },
    );
    await pair(
      "catalog_schedule_list",
      { sectionId: section.id },
      {
        "data.id": scheduleId,
        "data.customPlace": "Projection classroom",
        "data.startTime": "08:00",
        "data.endTime": "09:35",
        "data.teachers.nameCn": teacher.nameCn,
      },
    );
    await pair("catalog_section_schedule_list", sectionArgs, {
      "schedules.id": scheduleId,
      "schedules.customPlace": "Projection classroom",
    });
    await pair("workspace_schedule_list", range, {
      "schedules.id": scheduleId,
      "schedules.section.code": section.code,
    });
    await pair("catalog_section_exam_list", sectionArgs, {
      "exams.examMode": "闭卷",
      "exams.examBatch.namePrimary": "契约考试批次",
    });
    await pair("workspace_exam_list", range, {
      "exams.examMode": "闭卷",
      "exams.section.course.nameCn": course.nameCn,
    });
  },
);
contractTest(
  "MCP personal academic readers preserve explicit compact and full projections",
  async ({ state, expect }) => {
    const {
      date,
      atTime,
      dueAt,
      catalog,
      homeworkId,
      todoId,
      scheduleId,
      pair,
    } = state;

    const course = catalog.courses[0];
    const section = catalog.sections[0];
    const teacher = catalog.teachers[0];
    const sectionArgs = { sectionJwId: section.jwId };
    const range = { dateFrom: date, dateTo: date };
    await pair(
      "workspace_homework_list",
      {},
      {
        "homeworks.title": "Projection homework",
        "homeworks.submissionDueAt": dueAt,
        "homeworks.requiresTeam": true,
        "homeworks.id": homeworkId,
      },
    );
    await pair("community_section_homework_list", sectionArgs, {
      "homeworks.id": homeworkId,
      "homeworks.title": "Projection homework",
    });
    await pair(
      "workspace_todo_list",
      {},
      {
        "todos.id": todoId,
        "todos.title": "Projection todo",
        "todos.content": "Projection todo details",
        "todos.priority": "high",
        "todos.dueAt": dueAt,
        "todos.completed": false,
      },
    );
    await pair(
      "workspace_subscription_list",
      {},
      {
        "sections.code": section.code,
        "sections.course.nameCn": course.nameCn,
      },
    );
    await pair(
      "workspace_calendar_feed_get",
      {},
      {
        "subscription.currentSemesterSections.course.namePrimary":
          course.nameCn,
        "subscription.sectionCount": 1,
      },
    );
    await pair(
      "catalog_section_calendar_feed_get",
      { jwId: section.jwId },
      { "section.code": section.code },
    );
    for (const [locale, name] of [
      ["zh-cn", teacher.nameCn],
      ["en-us", teacher.nameEn],
    ] as const) {
      await pair(
        "catalog_section_calendar_feed_get",
        { jwId: section.jwId, locale },
        { "section.teachers.namePrimary": name },
      );
    }
    for (const name of [
      "workspace_calendar_event_list",
      "workspace_calendar_timeline_get",
    ]) {
      const { compact, full } = await pair(
        name,
        { ...range, atTime },
        { "events.type": "schedule" },
      );
      for (const type of ["schedule", "exam", "homework_due", "todo_due"]) {
        const event = (compact.events as Row[]).find(
          (row) => row.type === type,
        );
        expect(event, `${name}.${type}`).toBeDefined();
        expect(
          (full.events as Row[]).find((row) => row.type === type),
        ).toBeDefined();
      }
      expect(values(compact, ["events", "payload", "title"])).toContain(
        "Projection todo",
      );
    }
    await pair(
      "workspace_snapshot_get",
      { atTime },
      { "nextClass.payload.id": scheduleId },
    );
    await pair(
      "workspace_schedule_next",
      { atTime },
      { "nextClass.payload.id": scheduleId },
    );
    await pair(
      "workspace_deadline_list",
      { atTime },
      { "deadlines.type": "homework_due" },
    );
    await pair(
      "workspace_overview_get",
      { atTime },
      {
        "overview.pendingHomeworksCount": 1,
        "overview.pendingTodosCount": 1,
        "overview.upcomingExamsCount": 1,
        "overview.todaySchedulesCount": 1,
      },
    );
  },
);
contractTest(
  "MCP bus and link projections retain display fields and personal state",
  async ({ state }) => {
    const { atTime, invoke, pair } = state;

    await pair(
      "catalog_bus_timetable_get",
      {},
      { "routes.id": state.mcpBus.routeId },
    );
    await pair(
      "catalog_bus_route_list",
      {},
      { "routes.id": state.mcpBus.routeId },
    );
    await pair(
      "catalog_bus_route_get",
      { routeId: state.mcpBus.routeId },
      { "route.id": state.mcpBus.routeId },
    );
    const busArgs = {
      originCampusId: state.mcpBus.originCampusId,
      destinationCampusId: state.mcpBus.destinationCampusId,
    };
    await pair("catalog_bus_route_search", busArgs, {
      "routes.id": state.mcpBus.routeId,
    });
    await pair(
      "catalog_bus_departure_next",
      { ...busArgs, atTime, dayType: "weekday" },
      { "originCampus.id": state.mcpBus.originCampusId },
    );
    await pair(
      "workspace_bus_preferences_get",
      {},
      {
        "preference.preferredOriginCampusId": state.mcpBus.originCampusId,
        "preference.showDepartedTrips": true,
      },
    );
    const links = await pair("catalog_link_list", {}, {});
    const firstLink = (links.compact.links as Row[])[0];
    for (const mode of ["default", "full"] as const)
      await invoke(
        "workspace_link_pin_set",
        { action: "pin", slug: firstLink.slug },
        { success: true },
        mode,
      );
    await pair(
      "workspace_link_pin_list",
      {},
      { pinnedSlugs: [firstLink.slug] },
    );
  },
);
contractTest(
  "MCP community and uploads preserve explicit compact and full projections",
  async ({ state, expect }) => {
    const {
      userId,
      userName,
      username,
      youngId,
      catalog,
      commentId,
      uploadId,
      organizerId,
      pair,
    } = state;

    const course = catalog.courses[0];
    const section = catalog.sections[0];
    const sectionArgs = { sectionJwId: section.jwId };
    await pair(
      "community_comment_list",
      { targetType: "section", ...sectionArgs },
      {
        "data.body": "Projection comment **Markdown**",
        "data.author.name": userName,
      },
    );
    const comments = await pair(
      "community_comment_get",
      { commentId },
      {
        "thread.body": "Projection comment **Markdown**",
        "thread.author.name": userName,
      },
    );
    expect((comments.compact.thread as Row[])[0]).not.toHaveProperty(
      "renderedBody",
    );
    expect((comments.full.thread as Row[])[0]).toHaveProperty("renderedBody");
    await pair(
      "community_comment_replies",
      { commentId },
      { "thread.body": "Projection comment **Markdown**" },
    );
    await pair(
      "community_description_get",
      { targetType: "course", courseJwId: course.jwId },
      {
        "description.content": "Projection course **Markdown**",
        "description.lastEditedBy.name": userName,
      },
    );
    await pair(
      "workspace_upload_list",
      {},
      {
        "data.filename": "projection.txt",
        "data.id": uploadId,
        "data.size": 321,
        "meta.usedBytes": 321,
      },
    );
    await pair(
      "account_profile_get",
      {},
      { name: userName, username, id: userId },
    );
    await pair(
      "community_user_get",
      { identifier: username },
      { "user.name": userName, "user.username": username },
    );
    const weather = await pair(
      "catalog_weather_get",
      { locationKey: "ustc-main" },
      { "location.key": "ustc-main", "current.temperature": 23 },
    );
    expect(weather.compact).not.toHaveProperty("extensions");
    expect(weather.full).toHaveProperty(
      "extensions.amap.privateMarker",
      "raw-weather-projection",
    );
    await pair(
      "catalog_young_event_list",
      { search: catalog.marker },
      {
        "data.youngId": youngId,
        "data.location": "Projection event room",
        "data.status": "报名中",
      },
    );
    const young = await pair(
      "catalog_young_event_get",
      { youngId },
      { "event.youngId": youngId, "event.module": "智" },
    );
    expect(young.compact.event).not.toHaveProperty("rawJson");
    expect(young.full.event).toHaveProperty(
      "rawJson.rawMarker",
      "raw-young-projection",
    );
    await pair(
      "catalog_young_organizer_list",
      { search: catalog.marker },
      { "data.id": organizerId, "data.totalCount": 1 },
    );
    await pair(
      "catalog_young_organizer_get",
      { organizerId },
      { "organizer.id": organizerId, "organizer.totalCount": 1 },
    );
    await pair(
      "graphql_operation_run",
      {
        document: "query PriorityProfile { account { profile { id name } } }",
        operationName: "PriorityProfile",
      },
      {
        "data.account.profile.id": userId,
        operationName: "PriorityProfile",
        operationType: "query",
      },
    );
  },
);
contractTest.for(["default", "full"] as const)(
  "MCP todo mutation projection in %s mode",
  async (mode, { state, expect }) => {
    const { dueAt, invoke, db } = state;

    const createdTodo = await invoke(
      "workspace_todo_create",
      {
        title: "Projection mutation todo",
        content: "Mutation detail",
        priority: "low",
        dueAt,
      },
      {},
      mode,
    );
    expect(createdTodo.id).toEqual(expect.any(String));
    await invoke(
      "workspace_todo_update",
      {
        id: createdTodo.id,
        title: "Projection changed todo",
        dueAt,
        priority: "high",
        completed: true,
      },
      {
        "todo.title": "Projection changed todo",
        "todo.priority": "high",
        "todo.completed": true,
      },
      mode,
    );
    expect(
      await db.todo.findUnique({
        where: { id: String(createdTodo.id) },
        select: { title: true, priority: true, completed: true },
      }),
    ).toEqual({
      title: "Projection changed todo",
      priority: "high",
      completed: true,
    });
    await invoke(
      "workspace_todo_delete",
      { id: createdTodo.id },
      { success: true },
      mode,
    );
    expect(await db.todo.count({ where: { id: String(createdTodo.id) } })).toBe(
      0,
    );
  },
);
contractTest.for(["default", "full"] as const)(
  "MCP homework mutation projection in %s mode",
  async (mode, { state, expect }) => {
    const { dueAt, catalog, invoke, db } = state;

    const sectionArgs = { sectionJwId: catalog.sections[0].jwId };
    const createdHomework = await invoke(
      "community_section_homework_create",
      {
        ...sectionArgs,
        title: "Projection mutation homework",
        submissionDueAt: dueAt,
        isMajor: true,
        requiresTeam: true,
      },
      {
        "homework.title": "Projection mutation homework",
        "homework.isMajor": true,
      },
      mode,
    );
    const id = (createdHomework.homework as Row).id;
    await invoke(
      "community_section_homework_update",
      { homeworkId: id, title: "Projection changed homework", isMajor: false },
      {
        "homework.title": "Projection changed homework",
        "homework.isMajor": false,
      },
      mode,
    );
    expect(
      await db.homework.findUnique({
        where: { id: String(id) },
        select: { title: true, isMajor: true },
      }),
    ).toEqual({ title: "Projection changed homework", isMajor: false });
    await invoke(
      "workspace_homework_completion_set",
      { homeworkId: id, completed: true },
      { "completion.completed": true, "completion.homeworkId": id },
      mode,
    );
    await invoke(
      "community_section_homework_delete",
      { homeworkId: id },
      { deletedId: id, alreadyDeleted: false },
      mode,
    );
  },
);
contractTest.for(["default", "full"] as const)(
  "MCP subscription mutation projection in %s mode",
  async (mode, { state }) => {
    const { catalog, currentSemesterId, invoke } = state;

    await invoke(
      "workspace_subscription_import",
      { codes: [catalog.sections[1].code], semesterId: currentSemesterId },
      {
        addedCount: 1,
        alreadySubscribedCount: 0,
      },
      mode,
    );
    await invoke(
      "workspace_subscription_import",
      { codes: [catalog.sections[1].code], semesterId: currentSemesterId },
      { addedCount: 0, alreadySubscribedCount: 1 },
      mode,
    );
    await invoke(
      "workspace_subscription_kind_update",
      { jwId: catalog.sections[1].jwId, kind: "auditor" },
      { kind: "auditor", sectionJwId: catalog.sections[1].jwId },
      mode,
    );
  },
);
contractTest.for(["default", "full"] as const)(
  "MCP bus preference mutation projection in %s mode",
  async (mode, { state }) => {
    const { invoke } = state;

    await invoke(
      "workspace_bus_preferences_set",
      {
        preferredOriginCampusId: state.mcpBus.destinationCampusId,
        preferredDestinationCampusId: state.mcpBus.originCampusId,
        showDepartedTrips: false,
      },
      {
        "preference.preferredOriginCampusId": state.mcpBus.destinationCampusId,
        "preference.showDepartedTrips": false,
      },
      mode,
    );
  },
);
contractTest.for(["default", "full"] as const)(
  "MCP comment mutation projection in %s mode",
  async (mode, { state }) => {
    const { catalog, invoke } = state;

    const sectionArgs = { sectionJwId: catalog.sections[0].jwId };
    const createdComment = await invoke(
      "community_comment_create",
      {
        targetType: "section",
        ...sectionArgs,
        body: "Projection mutation comment",
        visibility: "public",
      },
      {},
      mode,
    );
    const mutationCommentId = String(createdComment.id);
    await invoke(
      "community_comment_update",
      { commentId: mutationCommentId, body: "Projection changed comment" },
      {
        "comment.body": "Projection changed comment",
        "comment.id": mutationCommentId,
      },
      mode,
    );
    await invoke(
      "community_comment_reaction_add",
      { commentId: mutationCommentId, type: "heart" },
      { changed: true },
      mode,
    );
    await invoke(
      "community_comment_reaction_remove",
      { commentId: mutationCommentId, type: "heart" },
      { changed: true },
      mode,
    );
    await invoke(
      "community_comment_delete",
      { commentId: mutationCommentId },
      { success: true },
      mode,
    );
  },
);
contractTest.for(["default", "full"] as const)(
  "MCP description mutation projection in %s mode",
  async (mode, { state }) => {
    const { userName, catalog, invoke } = state;

    const course = catalog.courses[0];
    await invoke(
      "community_description_set",
      {
        targetType: "course",
        courseJwId: course.jwId,
        content: `Projection changed description ${mode}`,
      },
      {
        "description.content": `Projection changed description ${mode}`,
        "description.lastEditedBy.name": userName,
      },
      mode,
    );
  },
);
contractTest.for(["default", "full"] as const)(
  "MCP upload mutation projection in %s mode",
  async (mode, { state, expect }) => {
    const { userId, invoke, db, deletedKeys } = state;

    const upload = await db.upload.create({
      data: {
        userId,
        key: `uploads/${userId}/${mode}.txt`,
        filename: `${mode}.txt`,
        size: 24,
      },
    });
    await invoke(
      "workspace_upload_rename",
      { id: upload.id, filename: `changed-${mode}.txt` },
      { "upload.filename": `changed-${mode}.txt`, "upload.id": upload.id },
      mode,
    );
    await invoke(
      "workspace_upload_delete",
      { id: upload.id },
      { success: true },
      mode,
    );
    expect(deletedKeys.has(upload.key)).toBe(true);
    expect(await db.upload.count({ where: { id: upload.id } })).toBe(0);
  },
);
contractTest(
  "MCP completed todo consumers retain mode-specific fields",
  async ({ state, expect }) => {
    const { dueAt, client, todoId, db } = state;

    await db.todo.update({ where: { id: todoId }, data: { completed: true } });
    for (const mode of ["default", "full"] as const) {
      const result = await client.call<{ todos: Row[] }>(
        "workspace_todo_list",
        {
          includeCompleted: true,
          mode,
        },
      );
      const completed = result.todos.find((todo) => todo.id === todoId);
      expect(completed).toMatchObject({
        title: "Projection todo",
        completed: true,
        priority: "high",
        dueAt,
      });
      if (mode === "default") expect(completed).not.toHaveProperty("content");
      else
        expect(completed).toHaveProperty("content", "Projection todo details");
    }
  },
);
