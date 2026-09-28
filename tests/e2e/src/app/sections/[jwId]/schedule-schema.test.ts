import { expect, test } from "@playwright/test";
import {
  scheduleGroupsResponseSchema,
  sectionSchedulesResponseSchema,
} from "@/lib/api/schemas/schedule-response-schema-core";
import { createCalendarContractFixture } from "../../../../utils/calendar-contract";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";

test("section.schedule-response-schema", async ({ request }) => {
  const fixture = await createCalendarContractFixture();
  const marker = Math.floor(Math.random() * 100_000_000) + 1_900_000_000;
  let teacherId: number | undefined;
  try {
    const teacher = await withE2ePrisma(async (db) => {
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
      teacherId = teacher.id;
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
    });
    const documentResponse = await request.get("/api/openapi", {
      maxRetries: 1,
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
        { maxRetries: 1 },
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
        { maxRetries: 1 },
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
  } finally {
    await fixture.cleanup();
    if (teacherId)
      await withE2ePrisma((db) =>
        db.teacher.delete({ where: { id: teacherId } }),
      );
  }
});
