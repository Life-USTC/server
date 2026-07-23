import type { RequestEvent } from "@sveltejs/kit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { prisma } from "@/lib/db/prisma";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import {
  getOAuthGraphqlResourceUrl,
  getOAuthMcpResourceUrl,
  getOAuthRestAudienceUrls,
} from "@/lib/oauth/resource-urls";
import { restReadScope } from "@/lib/oauth/scope-registry";

const handler = createGraphqlRequestHandler(false);
const encoder = new TextEncoder();
const oauthClientId = `graphql-viewer-${crypto.randomUUID()}`;

type GraphqlPayload = {
  data?: Record<string, unknown> | null;
  errors?: Array<{
    message: string;
    extensions?: {
      code?: string;
      requiredScopes?: string[];
    };
  }>;
};

function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

async function signSessionCookieValue(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return encodeURIComponent(`${value}.${base64(new Uint8Array(signature))}`);
}

async function createSessionCookie(userId: string) {
  const token = crypto.randomUUID();
  await prisma.session.create({
    data: {
      expires: new Date(Date.now() + 60 * 60 * 1000),
      sessionToken: token,
      userId,
    },
  });
  const { getBetterAuthInstance } = await import("@/lib/auth/core");
  const context = await getBetterAuthInstance().$context;
  const value = await signSessionCookieValue(token, context.secret);
  return `${context.authCookies.sessionToken.name}=${value}`;
}

async function signToken(
  userId: string,
  scopes: string[],
  resource = getOAuthGraphqlResourceUrl(),
) {
  const consent = await prisma.oAuthConsent.findFirstOrThrow({
    where: {
      clientId: oauthClientId,
      scopes: { hasEvery: scopes },
      userId,
    },
    select: { grantId: true },
  });
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = await signResourceBoundOAuthAccessToken({
    clientId: oauthClientId,
    grantId: consent.grantId,
    expiresAt: issuedAt + 300,
    issuedAt,
    resources: [resource],
    scopes,
    userId,
  });
  if (!token) throw new Error("Expected a signed access token");
  return token;
}

function requestEvent(body: unknown, headers: HeadersInit = {}): RequestEvent {
  return {
    request: new Request(getOAuthGraphqlResourceUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...Object.fromEntries(new Headers(headers)),
      },
      body: JSON.stringify(body),
    }),
    locals: {
      authUser: null,
      locale: "zh-cn",
      requestId: "graphql-viewer-integration",
    },
  } as unknown as RequestEvent;
}

async function execute(body: unknown, headers: HeadersInit = {}) {
  const response = await handler(requestEvent(body, headers));
  return {
    response,
    payload: (await response.json()) as GraphqlPayload,
  };
}

const allViewerScopes = [
  restReadScope("me"),
  restReadScope("dashboard"),
  restReadScope("todo"),
  restReadScope("subscription"),
  restReadScope("homework"),
  restReadScope("schedule"),
  restReadScope("exam"),
];

describe.sequential("GraphQL Viewer integration", () => {
  let firstSectionId = 0;
  let firstSectionJwId = 0;
  let secondSectionId = 0;
  let firstScheduleDate: Date;
  let firstUserId = "";
  let secondUserId = "";
  let sessionCookie = "";
  let graphqlBearer = "";
  const userEmails: string[] = [];

  beforeAll(async () => {
    const sections = await prisma.section.findMany({
      where: {
        exams: { some: {} },
        homeworks: { some: { deletedAt: null } },
        schedules: { some: { date: { not: null } } },
      },
      select: {
        id: true,
        jwId: true,
        schedules: {
          where: { date: { not: null } },
          select: { date: true },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          take: 1,
        },
      },
      orderBy: { id: "asc" },
      take: 2,
    });
    if (sections.length < 2 || !sections[0].schedules[0]?.date) {
      throw new Error("Expected two seeded sections with Viewer data");
    }
    firstSectionId = sections[0].id;
    firstSectionJwId = sections[0].jwId;
    secondSectionId = sections[1].id;
    firstScheduleDate = sections[0].schedules[0].date;

    const marker = crypto.randomUUID();
    userEmails.push(
      `graphql-viewer-a-${marker}@example.test`,
      `graphql-viewer-b-${marker}@example.test`,
    );
    const [firstUser, secondUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: userEmails[0],
          name: "GraphQL Viewer A",
          username: `graphql-viewer-a-${marker}`,
          subscribedSections: { connect: { id: firstSectionId } },
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: userEmails[1],
          name: "GraphQL Viewer B",
          username: `graphql-viewer-b-${marker}`,
          subscribedSections: { connect: { id: secondSectionId } },
        },
        select: { id: true },
      }),
    ]);
    firstUserId = firstUser.id;
    secondUserId = secondUser.id;

    await Promise.all([
      prisma.oAuthClient.create({
        data: {
          clientId: oauthClientId,
          consents: {
            create: {
              scopes: allViewerScopes,
              userId: firstUserId,
            },
          },
          name: "GraphQL viewer integration",
          redirectUris: ["https://graphql.example/callback"],
        },
      }),
      prisma.todo.createMany({
        data: [
          {
            title: `[integration-test] graphql-viewer-a-${marker}`,
            userId: firstUserId,
          },
          {
            title: `[integration-test] graphql-viewer-b-${marker}`,
            userId: secondUserId,
          },
        ],
      }),
      prisma.userSuspension.create({
        data: {
          reason: "[integration-test] reads remain available",
          userId: firstUserId,
        },
      }),
    ]);

    sessionCookie = await createSessionCookie(firstUserId);
    graphqlBearer = await signToken(firstUserId, allViewerScopes);
  });

  afterAll(async () => {
    await prisma.oAuthClient.deleteMany({
      where: { clientId: oauthClientId },
    });
    if (userEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: userEmails } },
      });
    }
    await prisma.$disconnect();
  });

  it("returns account=null to anonymous callers and marks the response no-store", async () => {
    const { response, payload } = await execute({
      query: "{ account { profile { id } } }",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toEqual({ data: { account: null } });
  });

  it("serves account and workspace fields through a trusted-Origin session", async () => {
    const shanghaiMidnightInstant = new Date(
      firstScheduleDate.getTime() - 8 * 60 * 60 * 1000,
    ).toISOString();
    const { response, payload } = await execute(
      {
        query: /* GraphQL */ `
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
            }
            semester {
              id
              jwId
              code
              nameCn
              startDate
              endDate
            }
            campus {
              id
              jwId
              code
              nameCn
              nameEn
            }
            openDepartment {
              id
              code
              nameCn
              nameEn
            }
            examMode {
              id
              nameCn
              nameEn
            }
            teachLanguage {
              id
              nameCn
              nameEn
            }
          }

          query ViewerBySession($date: DateTime!) {
            account {
              profile {
                id
                email
                username
                name
                isAdmin
                createdAt
                updatedAt
              }
            }
            viewer: workspace {
              overview(atTime: "2026-04-29T08:00:00+08:00") {
                atTime
                today
                incompleteTodos
                pendingHomeworks
                todaySchedules
                upcomingExams
              }
              todos {
                items {
                  id
                  title
                }
                pageInfo {
                  page
                  pageSize
                  total
                  totalPages
                }
              }
              subscribedSections {
                items {
                  ...SectionFields
                }
                pageInfo {
                  pageSize
                  total
                }
              }
              homeworks {
                items {
                  id
                  completed
                  completedAt
                  commentCount
                  section {
                    id
                    jwId
                    course {
                      id
                      category {
                        id
                        nameCn
                      }
                    }
                    campus {
                      id
                    }
                    openDepartment {
                      id
                    }
                    examMode {
                      id
                    }
                    teachLanguage {
                      id
                    }
                  }
                }
                pageInfo {
                  total
                }
              }
              schedules(filter: { dateFrom: $date, dateTo: $date }) {
                items {
                  id
                  date
                  section {
                    id
                    jwId
                  }
                  teachers(page: { pageSize: 1 }) {
                    items {
                      id
                      sectionCount
                    }
                    pageInfo {
                      total
                    }
                  }
                }
                pageInfo {
                  total
                }
              }
              exams {
                items {
                  id
                  examDate
                  section {
                    id
                    jwId
                  }
                }
                pageInfo {
                  total
                }
              }
            }
          }
        `,
        variables: { date: shanghaiMidnightInstant },
      },
      {
        cookie: sessionCookie,
        origin: new URL(getOAuthGraphqlResourceUrl()).origin,
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.errors).toBeUndefined();
    const account = payload.data?.account as { profile: { id: string } };
    const viewer = payload.data?.viewer as {
      overview: { today: string };
      todos: {
        items: Array<{ title: string }>;
        pageInfo: { pageSize: number; total: number };
      };
      subscribedSections: {
        items: Array<{ id: number; jwId: number }>;
        pageInfo: { pageSize: number; total: number };
      };
      homeworks: {
        items: Array<{ section: { id: number } }>;
        pageInfo: { total: number };
      };
      schedules: {
        items: Array<{ date: string; section: { id: number } }>;
        pageInfo: { total: number };
      };
      exams: {
        items: Array<{ section: { id: number } }>;
        pageInfo: { total: number };
      };
    };
    expect(account.profile.id).toBe(firstUserId);
    expect(viewer.overview.today).toBe("2026-04-29");
    expect(viewer.todos.pageInfo).toMatchObject({ pageSize: 20, total: 1 });
    expect(viewer.todos.items[0]?.title).toContain("graphql-viewer-a");
    expect(viewer.subscribedSections.pageInfo).toMatchObject({
      pageSize: 20,
      total: 1,
    });
    expect(viewer.subscribedSections.items).toMatchObject([
      { id: firstSectionId, jwId: firstSectionJwId },
    ]);
    for (const page of [viewer.homeworks, viewer.schedules, viewer.exams]) {
      expect(page.pageInfo.total).toBeGreaterThan(0);
      expect(
        page.items.every((item) => item.section.id === firstSectionId),
      ).toBe(true);
      expect(
        page.items.every((item) => item.section.id !== secondSectionId),
      ).toBe(true);
    }
    expect(
      viewer.schedules.items.every(
        (schedule) =>
          schedule.date === firstScheduleDate.toISOString().slice(0, 10),
      ),
    ).toBe(true);
  });

  it("hydrates every nested Schedule Teacher field without a fallback query", async () => {
    const { payload } = await execute(
      {
        query: /* GraphQL */ `
          {
            viewer: workspace {
              schedules(page: { pageSize: 1 }) {
                items {
                  teachers {
                    items {
                      id
                      department {
                        id
                      }
                      teacherTitle {
                        id
                        nameCn
                      }
                      sectionCount
                    }
                    pageInfo {
                      page
                      pageSize
                      total
                      totalPages
                    }
                  }
                }
              }
            }
          }
        `,
      },
      {
        cookie: sessionCookie,
        origin: new URL(getOAuthGraphqlResourceUrl()).origin,
      },
    );

    expect(payload.errors).toBeUndefined();
    const viewer = payload.data?.viewer as {
      schedules: {
        items: Array<{
          teachers: {
            items: Array<{
              sectionCount: number;
              teacherTitle: { id: number; nameCn: string } | null;
            }>;
            pageInfo: {
              page: number;
              pageSize: number;
              total: number;
              totalPages: number;
            };
          };
        }>;
      };
    };
    const teachers = viewer.schedules.items.flatMap(
      (schedule) => schedule.teachers.items,
    );
    const teacherPageInfo = viewer.schedules.items[0]?.teachers.pageInfo;
    expect(teachers.length).toBeGreaterThan(0);
    expect(teacherPageInfo).toMatchObject({
      page: 1,
      pageSize: 20,
    });
    expect(teacherPageInfo?.total).toBeGreaterThanOrEqual(teachers.length);
    expect(teacherPageInfo?.totalPages).toBe(
      Math.max(1, Math.ceil((teacherPageInfo?.total ?? 0) / 20)),
    );
    expect(
      teachers.every(
        (teacher) =>
          teacher.sectionCount >= 1 &&
          typeof teacher.teacherTitle?.nameCn === "string",
      ),
    ).toBe(true);
  });

  it("bounds nested Schedule teachers and Exam rooms with PageInput", async () => {
    const headers = {
      cookie: sessionCookie,
      origin: new URL(getOAuthGraphqlResourceUrl()).origin,
    };
    const accepted = await execute(
      {
        query: /* GraphQL */ `
          {
            viewer: workspace {
              schedules(page: { pageSize: 1 }) {
                items {
                  defaultTeachers: teachers {
                    items { id }
                    pageInfo { page pageSize total totalPages }
                  }
                  maxTeachers: teachers(page: { pageSize: 100 }) {
                    items { id }
                    pageInfo { page pageSize total totalPages }
                  }
                }
              }
              exams(page: { pageSize: 1 }) {
                items {
                  defaultRooms: examRooms {
                    items { id room count }
                    pageInfo { page pageSize total totalPages }
                  }
                  maxRooms: examRooms(page: { pageSize: 100 }) {
                    items { id }
                    pageInfo { page pageSize total totalPages }
                  }
                }
              }
            }
          }
        `,
      },
      headers,
    );

    expect(accepted.payload.errors).toBeUndefined();
    const viewer = accepted.payload.data?.viewer as {
      schedules: {
        items: Array<{
          defaultTeachers: {
            items: Array<{ id: number }>;
            pageInfo: {
              page: number;
              pageSize: number;
              total: number;
              totalPages: number;
            };
          };
          maxTeachers: {
            items: Array<{ id: number }>;
            pageInfo: {
              page: number;
              pageSize: number;
              total: number;
              totalPages: number;
            };
          };
        }>;
      };
      exams: {
        items: Array<{
          defaultRooms: {
            items: Array<{ id: number }>;
            pageInfo: {
              page: number;
              pageSize: number;
              total: number;
              totalPages: number;
            };
          };
          maxRooms: {
            items: Array<{ id: number }>;
            pageInfo: {
              page: number;
              pageSize: number;
              total: number;
              totalPages: number;
            };
          };
        }>;
      };
    };
    const schedule = viewer.schedules.items[0];
    const exam = viewer.exams.items[0];
    expect(schedule).toBeDefined();
    expect(exam).toBeDefined();
    const expectFirstPage = (
      page:
        | {
            items: readonly unknown[];
            pageInfo: {
              page: number;
              pageSize: number;
              total: number;
              totalPages: number;
            };
          }
        | undefined,
      pageSize: number,
    ) => {
      expect(page?.pageInfo).toMatchObject({ page: 1, pageSize });
      expect(page?.items.length).toBeLessThanOrEqual(pageSize);
      expect(page?.pageInfo.total).toBeGreaterThanOrEqual(
        page?.items.length ?? 0,
      );
      expect(page?.pageInfo.totalPages).toBe(
        Math.max(1, Math.ceil((page?.pageInfo.total ?? 0) / pageSize)),
      );
    };
    expectFirstPage(schedule?.defaultTeachers, 20);
    expectFirstPage(schedule?.maxTeachers, 100);
    expectFirstPage(exam?.defaultRooms, 20);
    expectFirstPage(exam?.maxRooms, 100);

    for (const nestedField of [
      "teachers(page: { pageSize: 101 })",
      "examRooms(page: { pageSize: 101 })",
    ]) {
      const parentField = nestedField.startsWith("teachers")
        ? "schedules"
        : "exams";
      const rejected = await execute(
        {
          query: `{
            viewer: workspace {
              ${parentField}(page: { pageSize: 1 }) {
                items {
                  ${nestedField} { pageInfo { total } }
                }
              }
            }
          }`,
        },
        headers,
      );
      expect(rejected.payload.errors?.[0]?.extensions).toMatchObject({
        code: "BAD_USER_INPUT",
      });
    }
  });

  it("accepts a GraphQL-only bearer and enforces each selected field scope", async () => {
    const authorized = await execute(
      {
        query: /* GraphQL */ `
          {
            account {
              profile {
                id
              }
            }
            viewer: workspace {
              todos {
                pageInfo {
                  total
                }
              }
            }
          }
        `,
      },
      { authorization: `Bearer ${graphqlBearer}` },
    );
    expect(authorized.payload.errors).toBeUndefined();
    expect(authorized.payload.data).toMatchObject({
      account: { profile: { id: firstUserId } },
      viewer: {
        todos: { pageInfo: { total: 1 } },
      },
    });

    const todoOnly = await signToken(firstUserId, [restReadScope("todo")]);
    const missing = await execute(
      {
        query: /* GraphQL */ `
          {
            account {
              profile {
                id
              }
            }
          }
        `,
      },
      { authorization: `Bearer ${todoOnly}` },
    );
    expect(missing.response.status).toBe(403);
    expect(missing.payload.errors?.[0]?.extensions).toMatchObject({
      code: "FORBIDDEN",
      requiredScopes: [restReadScope("me")],
    });

    const twoScopes = await signToken(firstUserId, [
      restReadScope("todo"),
      restReadScope("subscription"),
    ]);
    const multiField = await execute(
      {
        query: /* GraphQL */ `
          {
            viewer: workspace {
              todos {
                pageInfo {
                  total
                }
              }
              subscribedSections {
                pageInfo {
                  total
                }
              }
              homeworks {
                pageInfo {
                  total
                }
              }
            }
          }
        `,
      },
      { authorization: `Bearer ${twoScopes}` },
    );
    expect(multiField.response.status).toBe(403);
    expect(multiField.payload.errors?.[0]?.extensions).toMatchObject({
      code: "FORBIDDEN",
      requiredScopes: [restReadScope("homework")],
    });
  });

  it.each([
    ["REST", () => getOAuthRestAudienceUrls()[0] as string],
    ["MCP", getOAuthMcpResourceUrl],
  ])("rejects a %s bearer without falling back to a valid session cookie", async (_surface, resource) => {
    const wrongAudience = await signToken(
      firstUserId,
      [restReadScope("me")],
      resource(),
    );
    const { response, payload } = await execute(
      { query: "{ account { profile { id } } }" },
      {
        authorization: `Bearer ${wrongAudience}`,
        cookie: sessionCookie,
        origin: new URL(getOAuthGraphqlResourceUrl()).origin,
      },
    );

    expect(response.status).toBe(401);
    expect(payload.errors?.[0]?.extensions).toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(payload.data?.account).not.toMatchObject({
      profile: { id: firstUserId },
    });
  });

  it("enforces default/max pagination, ordered ranges, and strict zoned dates", async () => {
    const headers = { authorization: `Bearer ${graphqlBearer}` };
    const accepted = await execute(
      {
        query: /* GraphQL */ `
          {
            viewer: workspace {
              defaultPage: todos {
                pageInfo {
                  page
                  pageSize
                }
              }
              maxPage: todos(page: { pageSize: 100 }) {
                pageInfo {
                  pageSize
                }
              }
            }
          }
        `,
      },
      headers,
    );
    expect(accepted.payload.errors).toBeUndefined();
    expect(accepted.payload.data?.viewer).toMatchObject({
      defaultPage: { pageInfo: { page: 1, pageSize: 20 } },
      maxPage: { pageInfo: { pageSize: 100 } },
    });

    const oversized = await execute(
      {
        query:
          "{ viewer: workspace { todos(page: { pageSize: 101 }) { pageInfo { total } } } }",
      },
      headers,
    );
    expect(oversized.payload.errors?.[0]?.extensions).toMatchObject({
      code: "BAD_USER_INPUT",
    });

    const inverted = await execute(
      {
        query: /* GraphQL */ `
          {
            viewer: workspace {
              schedules(
                filter: {
                  dateFrom: "2026-04-30T00:00:00+08:00"
                  dateTo: "2026-04-29T00:00:00+08:00"
                }
              ) {
                pageInfo {
                  total
                }
              }
            }
          }
        `,
      },
      headers,
    );
    expect(inverted.payload.errors?.[0]?.extensions).toMatchObject({
      code: "BAD_USER_INPUT",
    });

    const timezoneMissing = await execute(
      {
        query: /* GraphQL */ `
          {
            viewer: workspace {
              schedules(filter: { dateFrom: "2026-04-29T00:00:00" }) {
                pageInfo {
                  total
                }
              }
            }
          }
        `,
      },
      headers,
    );
    expect(timezoneMissing.payload.errors?.[0]?.extensions).toMatchObject({
      code: "BAD_USER_INPUT",
    });
  });
});
