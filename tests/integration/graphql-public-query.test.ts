import type { RequestEvent } from "@sveltejs/kit";
import { describe, expect, it } from "vitest";
import { GRAPHQL_LIMITS } from "@/lib/graphql/constants";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { DEV_SEED, DEV_SEED_ANCHOR } from "../fixtures/dev-seed";

const developmentHandler = createGraphqlRequestHandler(false);
const productionHandler = createGraphqlRequestHandler(true);

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
  const response = await (production ? productionHandler : developmentHandler)(
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
  it("serves seeded catalog and bus data through the HTTP handler", async () => {
    const { response, payload } = await execute({
      query: /* GraphQL */ `
        query PublicFoundation(
          $courseJwId: Int!
          $sectionJwId: Int!
          $now: DateTime!
          $routeId: Int!
          $versionKey: String!
        ) {
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
      `,
      variables: {
        courseJwId: DEV_SEED.course.jwId,
        sectionJwId: DEV_SEED.section.jwId,
        now: DEV_SEED_ANCHOR.recommendedAtTime,
        routeId: DEV_SEED.bus.routeId,
        versionKey: DEV_SEED.bus.versionKey,
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.errors).toBeUndefined();
    expect(payload.data).toMatchObject({
      course: {
        jwId: DEV_SEED.course.jwId,
        code: DEV_SEED.course.code,
      },
      sections: {
        items: [
          {
            jwId: DEV_SEED.section.jwId,
            code: DEV_SEED.section.code,
          },
        ],
      },
      busTimetable: { route: { id: DEV_SEED.bus.routeId } },
    });
  });

  it("returns the same Section shape from list and detail queries", async () => {
    const { payload } = await execute({
      query: /* GraphQL */ `
        ${sectionFields}
        query SectionConsistency($jwId: Int!) {
          sections(filter: { jwIds: [$jwId] }, page: { pageSize: 1 }) {
            items {
              ...SectionFields
            }
          }
          section(jwId: $jwId) {
            ...SectionFields
          }
        }
      `,
      variables: { jwId: DEV_SEED.section.jwId },
    });

    expect(payload.errors).toBeUndefined();
    const data = payload.data as {
      sections: { items: unknown[] };
      section: Record<string, unknown>;
    };
    expect(data.sections.items).toEqual([data.section]);
    expect(data.section).toMatchObject({
      remark: DEV_SEED.section.remark,
      examMode: { nameCn: DEV_SEED.section.examModeNameCn },
      teachLanguage: { nameCn: DEV_SEED.section.teachLanguageNameCn },
    });
  });

  it("resolves a legacy course jwId for course detail and section lists", async () => {
    const { payload } = await execute({
      query: /* GraphQL */ `
        query CatalogByLegacyCourse($courseJwId: Int!) {
          course(jwId: $courseJwId) {
            jwId
            code
          }
          sections(
            filter: { courseJwId: $courseJwId }
            page: { pageSize: 10 }
          ) {
            items {
              jwId
              course {
                jwId
              }
            }
          }
        }
      `,
      variables: { courseJwId: DEV_SEED.course.legacyJwId },
    });

    expect(payload.errors).toBeUndefined();
    expect(payload.data).toMatchObject({
      course: {
        jwId: DEV_SEED.course.jwId,
        code: DEV_SEED.course.code,
      },
      sections: {
        items: [
          {
            jwId: DEV_SEED.section.jwId,
            course: { jwId: DEV_SEED.course.jwId },
          },
        ],
      },
    });
  });

  it("enforces production introspection and request-size boundaries", async () => {
    const introspection = await execute(
      { query: "{ __schema { queryType { name } } }" },
      true,
    );
    expect(introspection.payload.errors).not.toHaveLength(0);
    expect(introspection.payload.data).toBeUndefined();

    const oversized = await execute("x".repeat(GRAPHQL_LIMITS.bodyBytes + 1));
    expect(oversized.response.status).toBe(413);
    expect(oversized.payload.errors?.[0]?.message).toContain("must not exceed");
  });
});
