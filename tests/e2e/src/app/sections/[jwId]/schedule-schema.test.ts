import { expect } from "@playwright/test";
import {
  scheduleGroupsResponseSchema,
  sectionSchedulesResponseSchema,
} from "@/lib/api/schemas/schedule-response-schema-core";
import { test } from "../../../../utils/calendar-presentation-fixture";

test("section.schedule-response-schema", async ({
  calendar: fixture,
  calendarDb,
  request,
  run,
}, testInfo) => {
  await run(async () => {
    const probeId = crypto.randomUUID();
    const probePath = `/__test/community-effects?id=${probeId}`;
    const secret = {
      "x-test-storage-secret": "local-test-storage-observer",
    };
    const reads: {
      method: "GET";
      path: string;
      requestId: string;
    }[] = [];
    const readHeaders = (path: string) => {
      const requestId = crypto.randomUUID();
      reads.push({ method: "GET", path, requestId });
      return {
        ...secret,
        "x-test-community-probe": probeId,
        "x-test-community-request": requestId,
      };
    };
    const errors: unknown[] = [];
    let registered = false;
    let verifyScheduleState: (() => Promise<void>) | undefined;
    try {
      const registeredResponse = await request.post(probePath, {
        headers: secret,
      });
      expect(registeredResponse.status()).toBe(201);
      registered = true;
      const marker = Math.floor(Math.random() * 100_000_000) + 1_900_000_000;
      const teacher = await calendarDb((client) =>
        client.$transaction(async (db) => {
          const teacher = await db.teacher.create({
            data: {
              jwId: marker,
              personId: marker - 1,
              code: `SCHEMA-${marker}`,
              nameCn: `排课教师${marker}`,
              nameEn: `Schedule teacher ${marker}`,
              email: "private-schedule-email@example.test",
              mobile: "private-schedule-mobile",
            },
          });
          const schedule = await db.schedule.findFirstOrThrow({
            where: { sectionId: fixture.section.id },
          });
          await db.scheduleTeacher.create({
            data: {
              scheduleId: schedule.id,
              teacherId: teacher.id,
              periods: 2.5,
              exerciseClass: true,
            },
          });
          return teacher;
        }),
      );
      const storedScheduleState = () =>
        calendarDb((db) =>
          db.$transaction([
            db.schedule.findMany({
              where: { sectionId: fixture.section.id },
              orderBy: { id: "asc" },
            }),
            db.scheduleGroup.findMany({
              where: { sectionId: fixture.section.id },
              orderBy: { id: "asc" },
            }),
            db.teacher.findUniqueOrThrow({ where: { id: teacher.id } }),
            db.scheduleTeacher.findMany({
              where: { teacherId: teacher.id },
              orderBy: { scheduleId: "asc" },
            }),
          ]),
        );
      const before = await storedScheduleState();
      verifyScheduleState = async () => {
        expect(await storedScheduleState()).toEqual(before);
      };
      const documentResponse = await request.get("/api/openapi", {
        headers: readHeaders("/api/openapi"),
      });
      expect(documentResponse.status()).toBe(200);
      const document = await documentResponse.json();
      const components = document.components.schemas;
      const schedulesPath = "/api/catalog/sections/{jwId}/schedules";
      const groupsPath = "/api/catalog/sections/{jwId}/schedule-groups";
      for (const [path, name] of [
        [schedulesPath, "sectionSchedulesResponseSchema"],
        [groupsPath, "scheduleGroupsResponseSchema"],
      ]) {
        expect(
          document.paths[path].get.responses["200"].content["application/json"]
            .schema,
        ).toEqual({ $ref: `#/components/schemas/${name}` });
        expect(components[name].type).toBe("array");
        expect(components[name].items.type).toBe("object");
        expect(components[name].items.properties.id.type).toBe("integer");
        expect(components[name].items.required).toContain("id");
      }
      const schema = components.sectionSchedulesResponseSchema.items;
      expect(
        schema.properties.teacherParticipations.items.properties.periods.type,
      ).toBe("number");
      expect(
        schema.properties.teacherParticipations.items.properties.exerciseClass
          .type,
      ).toBe("boolean");
      expect(schema.properties.teachers.items.properties.namePrimary.type).toBe(
        "string",
      );
      expect(schema.properties.scheduleGroup.properties.jwId.type).toBe(
        "integer",
      );
      expect(
        components.scheduleGroupsResponseSchema.items.properties.schedules.items
          .properties.startTime.type,
      ).toBe("string");
      for (const locale of ["zh-cn", "en-us"]) {
        const response = await request.get(
          `/api/catalog/sections/${fixture.section.jwId}/schedules?locale=${locale}`,
          {
            headers: readHeaders(
              `/api/catalog/sections/${fixture.section.jwId}/schedules`,
            ),
          },
        );
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(sectionSchedulesResponseSchema.parse(body)).toEqual(body);
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
          date: `${fixture.date}T08:00:00+08:00`,
          startTime: "09:00",
          endTime: "10:00",
          scheduleGroup: { id: fixture.group.id, jwId: fixture.group.jwId },
          teachers: [
            {
              id: teacher.id,
              jwId: teacher.jwId,
              personId: teacher.personId,
              nameCn: teacher.nameCn,
              nameEn: teacher.nameEn,
              namePrimary: locale === "en-us" ? teacher.nameEn : teacher.nameCn,
            },
          ],
          teacherParticipations: [
            { periods: 2.5, exerciseClass: true, teacher: { id: teacher.id } },
          ],
        });
        expect(JSON.stringify(body)).not.toContain("private-schedule-");
        const groupsResponse = await request.get(
          `/api/catalog/sections/${fixture.section.jwId}/schedule-groups?locale=${locale}`,
          {
            headers: readHeaders(
              `/api/catalog/sections/${fixture.section.jwId}/schedule-groups`,
            ),
          },
        );
        expect(groupsResponse.status()).toBe(200);
        const groups = await groupsResponse.json();
        expect(scheduleGroupsResponseSchema.parse(groups)).toEqual(groups);
        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({
          id: fixture.group.id,
          schedules: [{ id: body[0].id, startTime: "09:00", endTime: "10:00" }],
        });
      }
    } catch (error) {
      errors.push(error);
    } finally {
      if (registered) {
        try {
          // The native probe joins handlers, response streams and waitUntil work.
          const response = await request.get(probePath, { headers: secret });
          expect(response.status()).toBe(200);
          const effects = await response.json();
          await verifyScheduleState?.();
          await testInfo.attach("schedule-read-effects", {
            body: JSON.stringify(effects, null, 2),
            contentType: "application/json",
          });
          expect(reads).toHaveLength(5);
          expect(effects).toEqual({
            purges: [],
            messages: [],
            backgroundErrors: [],
            requests: reads.map((value) => ({
              outcome: "fulfilled",
              value,
              result: 200,
            })),
          });
          expect(await calendarDb((db) => db.auditLog.count())).toBe(0);
        } catch (error) {
          errors.push(error);
        }
      }
    }
    if (errors.length)
      throw new AggregateError(errors, "Owned schedule schema consumer failed");
  });
});
