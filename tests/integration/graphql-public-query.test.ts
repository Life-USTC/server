import type { RequestEvent } from "@sveltejs/kit";
import { describe, expect } from "vitest";
import { GRAPHQL_LIMITS } from "@/lib/graphql/constants";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import type { TestPrismaClient } from "../shared/prisma";
import { publicCatalogProtocolTest } from "../shared/public-catalog-protocol-fixture";
import { createPrivateMcpBus } from "./mcp/_harness/bus-fixture";

async function createPublicCatalog(db: TestPrismaClient) {
  return db.$transaction(async (tx) => {
    const semester = await tx.semester.create({
      data: { jwId: 710001, code: "public-term", nameCn: "公共学期" },
    });
    const category = await tx.courseCategory.create({
      data: { nameCn: "公共类别" },
    });
    const course = await tx.course.create({
      data: {
        jwId: 710002,
        code: "GRAPHQL",
        nameCn: "GraphQL 公共课程",
        nameEn: "GraphQL public course",
        categoryId: category.id,
      },
    });
    const campus = await tx.campus.create({
      data: { jwId: 710003, code: "PUBLIC", nameCn: "公共校区" },
    });
    const department = await tx.department.create({
      data: { jwId: 710004, code: "PUBLIC", nameCn: "公共院系" },
    });
    const examMode = await tx.examMode.create({ data: { nameCn: "闭卷" } });
    const teachLanguage = await tx.teachLanguage.create({
      data: { nameCn: "中文" },
    });
    const teacher = await tx.teacher.create({
      data: { jwId: 710005, code: "PUBLIC", nameCn: "公共教师" },
    });
    const section = await tx.section.create({
      data: {
        jwId: 710006,
        code: "GRAPHQL.01",
        credits: 3,
        period: 48,
        periodsPerWeek: 3,
        timesPerWeek: 2,
        stdCount: 25,
        limitCount: 50,
        remark: "GraphQL public section remark",
        courseId: course.id,
        semesterId: semester.id,
        campusId: campus.id,
        openDepartmentId: department.id,
        examModeId: examMode.id,
        teachLanguageId: teachLanguage.id,
        teachers: { connect: { id: teacher.id } },
      },
    });
    for (const row of [
      semester,
      course,
      campus,
      department,
      teacher,
      section,
    ]) {
      expect(row.id).not.toBe(row.jwId);
    }
    return {
      semester,
      category,
      course,
      campus,
      department,
      examMode,
      teachLanguage,
      teacher,
      section,
    };
  });
}

const it = publicCatalogProtocolTest.extend<{
  publicCatalog: Awaited<ReturnType<typeof createPublicCatalog>>;
  publicBus: Awaited<ReturnType<typeof createPrivateMcpBus>>;
}>({
  publicCatalog: async (
    { isolatedDatabase, protocolRuntime, _publicCatalogRevision },
    use,
  ) => {
    const catalog = await protocolRuntime.run(() =>
      createPublicCatalog(isolatedDatabase.owner),
    );
    await use(catalog);
  },
  publicBus: async ({ isolatedDatabase, protocolRuntime }, use) => {
    const bus = await protocolRuntime.run(() =>
      createPrivateMcpBus(isolatedDatabase.owner),
    );
    await use(bus);
  },
});

function requestEvent(body: unknown): RequestEvent {
  return {
    request: new Request("https://example.test/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    locals: {
      authUser: null,
      locale: "zh-cn",
      requestId: "graphql-integration-test",
    },
  } as unknown as RequestEvent;
}

async function execute(body: unknown, production = false) {
  const response = await createGraphqlRequestHandler(production)(
    requestEvent(body),
  );
  return {
    response,
    payload: (await response.json()) as {
      data?: Record<string, unknown>;
      errors?: Array<{ message: string }>;
    },
  };
}

const sectionFields = /* GraphQL */ `
  fragment SectionFields on Section {
    id
    jwId
    code
    credits
    period
    periodsPerWeek
    timesPerWeek
    stdCount
    limitCount
    remark
    course {
      id
      jwId
      code
      nameCn
      nameEn
      category {
        id
        nameCn
      }
    }
    semester {
      id
      jwId
      code
      nameCn
    }
    campus {
      id
      jwId
      code
      nameCn
    }
    openDepartment {
      id
      code
      nameCn
    }
    examMode {
      id
      nameCn
    }
    teachLanguage {
      id
      nameCn
    }
  }
`;

describe("GraphQL public Query integration", () => {
  it("serves seeded catalog and bus data through the HTTP handler", async ({
    publicCatalog,
    publicBus,
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const { response, payload } = await protocolRuntime.request(() =>
        execute({
          query: /* GraphQL */ `
            query PublicFoundation(
              $courseJwId: Int!
              $sectionJwId: Int!
              $now: DateTime!
              $routeId: Int!
              $versionKey: String!
            ) {
              catalog {
                semesters(page: { pageSize: 10 }) {
                items {
                  jwId
                }
                }
                courses(filter: { search: "GraphQL" }, page: { pageSize: 10 }) {
                items {
                  jwId
                  code
                  nameCn
                }
                }
                course(jwId: $courseJwId) {
                jwId
                code
                nameCn
                }
                sections(
                filter: { jwIds: [$sectionJwId] }
                page: { pageSize: 10 }
                ) {
                items {
                  jwId
                  code
                }
                }
                teachers(page: { pageSize: 10 }) {
                items {
                  id
                  code
                  nameCn
                  sectionCount
                }
                }
                busRoutes(page: { pageSize: 10 }) {
                items {
                  id
                  nameCn
                }
                }
                busTimetable(
                routeId: $routeId
                now: $now
                versionKey: $versionKey
                ) {
                route {
                  id
                }
                }
              }
            }
          `,
          variables: {
            courseJwId: publicCatalog.course.jwId,
            sectionJwId: publicCatalog.section.jwId,
            now: "2026-04-29T08:00:00+08:00",
            routeId: publicBus.routeId,
            versionKey: publicBus.versionKey,
          },
        }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(payload.errors).toBeUndefined();
      expect(payload.data?.catalog).toMatchObject({
        course: {
          jwId: publicCatalog.course.jwId,
          code: publicCatalog.course.code,
        },
        sections: {
          items: [
            {
              jwId: publicCatalog.section.jwId,
              code: publicCatalog.section.code,
            },
          ],
        },
        busTimetable: { route: { id: publicBus.routeId } },
      });
      expect(payload.data?.catalog).toMatchObject({
        semesters: { items: [{ jwId: publicCatalog.semester.jwId }] },
        courses: {
          items: [
            {
              jwId: publicCatalog.course.jwId,
              code: publicCatalog.course.code,
              nameCn: publicCatalog.course.nameCn,
            },
          ],
        },
        course: { nameCn: publicCatalog.course.nameCn },
        teachers: {
          items: [
            {
              id: publicCatalog.teacher.id,
              code: publicCatalog.teacher.code,
              nameCn: publicCatalog.teacher.nameCn,
              sectionCount: 1,
            },
          ],
        },
        busRoutes: {
          items: [
            {
              id: publicBus.routeId,
              nameCn: `${publicBus.originCampusName} -> ${publicBus.destinationCampusName}`,
            },
          ],
        },
      });
    });
  });

  it("returns the same Section shape from list and detail queries", async ({
    publicCatalog,
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const { payload } = await protocolRuntime.request(() =>
        execute({
          query: /* GraphQL */ `
            ${sectionFields}
            query SectionConsistency($jwId: Int!) {
              catalog {
                sections(filter: { jwIds: [$jwId] }, page: { pageSize: 1 }) {
                  items {
                    ...SectionFields
                  }
                }
                section(jwId: $jwId) {
                  ...SectionFields
                }
              }
            }
          `,
          variables: { jwId: publicCatalog.section.jwId },
        }),
      );

      expect(payload.errors).toBeUndefined();
      const data = payload.data?.catalog as {
        sections: { items: unknown[] };
        section: Record<string, unknown>;
      };
      expect(data.sections.items).toEqual([data.section]);
      expect(data.section).toMatchObject({
        remark: publicCatalog.section.remark,
        examMode: { nameCn: publicCatalog.examMode.nameCn },
        teachLanguage: { nameCn: publicCatalog.teachLanguage.nameCn },
      });
      const {
        section,
        course,
        category,
        semester,
        campus,
        department,
        examMode,
        teachLanguage,
      } = publicCatalog;
      expect(data.section).toEqual({
        id: section.id,
        jwId: section.jwId,
        code: section.code,
        credits: section.credits,
        period: section.period,
        periodsPerWeek: section.periodsPerWeek,
        timesPerWeek: section.timesPerWeek,
        stdCount: section.stdCount,
        limitCount: section.limitCount,
        remark: section.remark,
        course: {
          id: course.id,
          jwId: course.jwId,
          code: course.code,
          nameCn: course.nameCn,
          nameEn: course.nameEn,
          category: { id: category.id, nameCn: category.nameCn },
        },
        semester: {
          id: semester.id,
          jwId: semester.jwId,
          code: semester.code,
          nameCn: semester.nameCn,
        },
        campus: {
          id: campus.id,
          jwId: campus.jwId,
          code: campus.code,
          nameCn: campus.nameCn,
        },
        openDepartment: {
          id: department.id,
          code: department.code,
          nameCn: department.nameCn,
        },
        examMode: { id: examMode.id, nameCn: examMode.nameCn },
        teachLanguage: { id: teachLanguage.id, nameCn: teachLanguage.nameCn },
      });
    });
  });

  it("enforces production introspection and request-size boundaries", async ({
    protocolRuntime,
  }) => {
    await protocolRuntime.run(async () => {
      const introspection = await protocolRuntime.request(() =>
        execute({ query: "{ __schema { queryType { name } } }" }, true),
      );
      expect(introspection.payload.errors).not.toHaveLength(0);
      expect(introspection.payload.data).toBeUndefined();

      const oversized = await protocolRuntime.request(() =>
        execute("x".repeat(GRAPHQL_LIMITS.bodyBytes + 1)),
      );
      expect(oversized.response.status).toBe(413);
      expect(oversized.payload.errors?.[0]?.message).toContain(
        "must not exceed",
      );
    });
  });
});
