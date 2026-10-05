import { getSchedulesRoute } from "@/lib/api/routes/academic-schedule-routes";
import { getSectionSchedulesRoute } from "@/lib/api/routes/academic-section-routes";
import { createGraphqlYoga } from "@/lib/graphql/server";
import { mapSchedule, mergeSchedule } from "@/static-loader/mappers";
import { writeSchedules } from "@/static-loader/schedule-writes";
import { publicCatalogProtocolTest } from "../../../shared/public-catalog-protocol-fixture";

const contractTest = publicCatalogProtocolTest.extend(
  "state",
  async ({
    isolatedDatabase: { owner: db },
    protocolRuntime,
    publicCatalogMcp,
    task: {
      context: { expect },
    },
  }) =>
    protocolRuntime.run(async () => {
      const marker = 2_020_000_000 + Math.floor(Math.random() * 100_000_000);
      const ownerId = crypto.randomUUID();
      const otherId = crypto.randomUUID();
      const facts = [
        { periods: 2.5, exerciseClass: false },
        { periods: 4, exerciseClass: true },
        { periods: null, exerciseClass: null },
      ];
      function source(index: number) {
        return {
          lessonId: marker,
          scheduleGroupId: marker,
          date: "2026-09-11",
          weekday: 5,
          weekIndex: 1,
          startTime: 750,
          endTime: 925,
          startUnit: 0,
          endUnit: 0,
          ...facts[index],
        };
      }
      async function importMeeting(order: number[]) {
        const first = order[0];
        const meeting = mapSchedule(source(first), marker + first);
        for (const index of order.slice(1))
          mergeSchedule(meeting, source(index), marker + index);
        await db.$transaction((tx) =>
          writeSchedules(
            tx,
            [meeting],
            new Map([[marker, sectionId]]),
            new Map([[marker, groupId]]),
            new Map(),
            new Map(teacherIds.map((id, index) => [marker + index, id])),
            [sectionId],
          ),
        );
      }
      async function listRest(locale = "", headers?: HeadersInit) {
        const response = await protocolRuntime.request(() =>
          getSchedulesRoute(
            new Request(
              `https://example.test/api/catalog/schedules?sectionId=${sectionId}${locale}`,
              { headers },
            ),
          ),
        );
        expect(response.status).toBe(200);
        return { response, body: (await response.json()) as { data: Entry[] } };
      }
      const { courseId, sectionId, groupId, teacherIds } =
        await db.$transaction(async (tx) => {
          const teacherIds: number[] = [];
          const courseId = (
            await tx.course.create({
              data: {
                jwId: marker,
                code: String(marker),
                nameCn: "排课中文",
                nameEn: "Schedule English",
              },
            })
          ).id;
          const sectionId = (
            await tx.section.create({
              data: { jwId: marker, code: `SCHEDULE.${marker}`, courseId },
            })
          ).id;
          const groupId = (
            await tx.scheduleGroup.create({
              data: {
                jwId: marker,
                sectionId,
                no: 1,
                stdCount: 0,
                limitCount: 0,
                actualPeriods: 4,
                isDefault: true,
              },
            })
          ).id;
          for (let index = 0; index < 3; index++)
            teacherIds.push(
              (
                await tx.teacher.create({
                  data: {
                    jwId: marker + index,
                    code: `SCHEDULE-${marker}-${index}`,
                    nameCn: "同名教师",
                    nameEn: `Teacher ${index}`,
                  },
                })
              ).id,
            );
          await tx.user.createMany({
            data: [ownerId, otherId].map((id) => ({
              id,
              name: "Schedule reader",
              email: `${id}@test.invalid`,
            })),
          });
          await tx.userSectionSubscription.create({
            data: { userId: ownerId, sectionId },
          });
          return { courseId, sectionId, groupId, teacherIds };
        });
      await importMeeting([0, 1, 2]);
      await publicCatalogMcp.initialize();
      const client = publicCatalogMcp.client;

      return {
        db,
        marker,
        client,
        courseId,
        sectionId,
        groupId,
        teacherIds,
        ownerId,
        otherId,
        facts,
        source,
        importMeeting,
        listRest,
      };
    }),
);

type Teacher = { id: number; jwId: number; code: string; nameCn: string };
type Entry = {
  id: number;
  teachers: Teacher[];
  teacherParticipations: {
    teacher: Teacher;
    periods: number | null;
    exerciseClass: boolean | null;
  }[];
  section?: { course: { namePrimary: string } };
};

for (const method of ["Service", "REST"] as const) {
  contractTest(
    `schedule.teacher-participation-facts (${method})`,
    { tags: [`@Catalog/${method}`] },
    async ({ state, protocolRuntime, expect }) =>
      protocolRuntime.run(async () => {
        const { db, sectionId, teacherIds, facts, importMeeting, listRest } =
          state;

        let scheduleId: number | undefined;
        for (const order of [
          [0, 1, 2],
          [2, 1, 0],
          [1, 0, 2],
        ]) {
          await importMeeting(order);
          const schedules = await db.schedule.findMany({
            where: { sectionId },
            include: {
              teacherParticipations: { orderBy: { teacherId: "asc" } },
            },
          });
          if (method === "Service") {
            expect(schedules).toHaveLength(1);
            if (scheduleId) expect(schedules[0].id).toBe(scheduleId);
            scheduleId = schedules[0].id;
            expect(
              schedules[0].teacherParticipations.map(
                ({ teacherId, periods, exerciseClass }) => ({
                  teacherId,
                  periods,
                  exerciseClass,
                }),
              ),
            ).toEqual(
              facts.map((fact, index) => ({
                teacherId: teacherIds[index],
                ...fact,
              })),
            );
            expect(schedules[0].exerciseClass).toBeNull();
          }
          if (method === "REST") {
            const { body } = await listRest();
            expect(
              body.data[0].teacherParticipations.map(
                ({ periods, exerciseClass }) => ({
                  periods,
                  exerciseClass,
                }),
              ),
            ).toEqual(facts);
          }
        }
      }),
  );
}

for (const method of ["REST", "MCP"] as const) {
  contractTest(
    `schedule.teacher-participation-output (${method})`,
    { tags: [`@Catalog/${method}`] },
    async ({ state, protocolRuntime, expect }) =>
      protocolRuntime.run(async () => {
        const { marker, client, sectionId, teacherIds, facts, listRest } =
          state;

        const results: Entry[][] = [];
        if (method === "REST") {
          const { body } = await listRest();
          const detail = await protocolRuntime.request(() =>
            getSectionSchedulesRoute(
              new Request(
                `https://example.test/api/catalog/sections/${marker}/schedules`,
              ),
              { jwId: String(marker) },
            ),
          );
          expect(detail.status).toBe(200);
          results.push(body.data, (await detail.json()) as Entry[]);
        }
        if (method === "MCP") {
          const mcpList = await client.call<{ data: Entry[] }>(
            "catalog_schedule_list",
            { sectionId, mode: "full" },
          );
          const mcpSection = await client.call<{ schedules: Entry[] }>(
            "catalog_section_schedule_list",
            { sectionJwId: marker, mode: "full" },
          );
          results.push(mcpList.data, mcpSection.schedules);
        }
        for (const rows of results) {
          expect(rows).toHaveLength(1);
          const entry = rows[0];
          expect(
            entry.teachers.map(({ id, jwId, code, nameCn }) => ({
              id,
              jwId,
              code,
              nameCn,
            })),
          ).toEqual(
            teacherIds.map((id, index) => ({
              id,
              jwId: marker + index,
              code: `SCHEDULE-${marker}-${index}`,
              nameCn: "同名教师",
            })),
          );
          expect(entry.teachers).toEqual(
            entry.teacherParticipations.map(({ teacher }) => teacher),
          );
          expect(
            entry.teacherParticipations.map(({ periods, exerciseClass }) => ({
              periods,
              exerciseClass,
            })),
          ).toEqual(facts);
        }
      }),
  );
}
contractTest(
  "schedule.public-rest-locale-cache",
  { tags: ["@Catalog/REST"] },
  async ({ state, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const { listRest } = state;

      for (const locale of ["", "&locale=zh-cn", "&locale=en-us"]) {
        const { response: baseline, body } = await listRest(locale);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].section?.course.namePrimary).toBe(
          locale === "&locale=en-us" ? "Schedule English" : "排课中文",
        );
        expect(baseline.headers.get("cache-control")).toContain("public");
        for (const headers of [
          { cookie: "locale=en-us", "accept-language": "en-US" },
          { cookie: "locale=zh-cn", "accept-language": "zh-CN" },
        ]) {
          const variant = await listRest(locale, headers);
          expect(variant.body).toEqual(body);
          expect(variant.response.headers.get("cache-control")).toBe(
            baseline.headers.get("cache-control"),
          );
          expect(variant.response.headers.get("vary") ?? "").not.toMatch(
            /cookie|accept-language/i,
          );
        }
      }
    }),
);

contractTest(
  "schedule.graphql-teacher-participation-output",
  { tags: ["@Catalog/GraphQL"] },
  async ({ state, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const { marker, teacherIds, ownerId, otherId, facts } = state;

      const query = `query($page: Int!) { workspace { schedules { items { id teachers(page: {page: $page, pageSize: 2}) { items { id jwId code nameCn } pageInfo { total } } teacherParticipations(page: {page: $page, pageSize: 2}) { items { teacher { id jwId code nameCn } periods exerciseClass } pageInfo { total } } } pageInfo { total } } } }`;
      const yoga = createGraphqlYoga(false);
      for (const userId of [ownerId, otherId]) {
        const actualTeachers: Teacher[] = [];
        const actualFacts: {
          teacher: Teacher;
          periods: number | null;
          exerciseClass: boolean | null;
        }[] = [];
        for (const page of [1, 2]) {
          const response = await protocolRuntime.request(() =>
            yoga.fetch(
              "https://example.test/api/graphql",
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ query, variables: { page } }),
              },
              {
                locals: { locale: "zh-cn" },
                principal: { kind: "session", userId },
              },
            ),
          );
          const body = await response.json();
          expect(body.errors).toBeUndefined();
          const schedules = body.data.workspace.schedules;
          expect(schedules.pageInfo.total).toBe(userId === ownerId ? 1 : 0);
          if (userId !== ownerId) {
            expect(schedules.items).toEqual([]);
            continue;
          }
          expect(schedules.items).toHaveLength(1);
          const meeting = schedules.items[0];
          expect(meeting.teachers.pageInfo.total).toBe(3);
          expect(meeting.teacherParticipations.pageInfo.total).toBe(3);
          expect(meeting.teachers.items).toHaveLength(page === 1 ? 2 : 1);
          expect(meeting.teacherParticipations.items).toHaveLength(
            page === 1 ? 2 : 1,
          );
          actualTeachers.push(...meeting.teachers.items);
          actualFacts.push(...meeting.teacherParticipations.items);
        }
        if (userId === ownerId) {
          expect(actualTeachers).toEqual(
            teacherIds.map((id, index) => ({
              id,
              jwId: marker + index,
              code: `SCHEDULE-${marker}-${index}`,
              nameCn: "同名教师",
            })),
          );
          expect(actualFacts.map(({ teacher }) => teacher)).toEqual(
            actualTeachers,
          );
          expect(
            actualFacts.map(({ periods, exerciseClass }) => ({
              periods,
              exerciseClass,
            })),
          ).toEqual(facts);
        }
      }
    }),
);
