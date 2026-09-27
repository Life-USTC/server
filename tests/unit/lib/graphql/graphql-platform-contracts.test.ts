import { createYoga } from "graphql-yoga";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("$app/environment", () => ({ dev: false }));

const services = vi.hoisted(() => ({
  schedules: vi.fn(),
  exams: vi.fn(),
  homeworks: vi.fn(),
  roomMap: vi.fn(),
  youngEvent: vi.fn(),
  sections: vi.fn(),
}));
vi.mock("@/features/subscriptions/server/subscription-read-model", () => ({
  listSubscribedSchedulePage: services.schedules,
  listSubscribedExamPage: services.exams,
  listSubscribedHomeworkPage: services.homeworks,
}));
vi.mock("@/features/rooms/server/room-map-service", () => ({
  getRoomMap: services.roomMap,
}));

import type { GraphqlContext } from "@/lib/graphql/context";

vi.mock("@/features/young/server/young-event-service", () => ({
  getYoungEvent: services.youngEvent,
}));
vi.mock("@/features/catalog/server/section-summary-read-model", () => ({
  listSections: services.sections,
}));

import { graphqlSchema } from "@/lib/graphql/schema";

async function graphql(input: {
  schema: typeof graphqlSchema;
  source: string;
  variableValues?: Record<string, unknown>;
  contextValue: Record<string, unknown>;
}) {
  const yoga = createYoga({
    schema: input.schema,
    graphqlEndpoint: "/api/graphql",
    context: ({ request }) =>
      ({ ...input.contextValue, request }) as GraphqlContext,
    logging: false,
  });
  const response = await yoga.fetch("https://life.example/api/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: input.source,
      variables: input.variableValues,
    }),
  });
  return (await response.json()) as {
    data?: unknown;
    errors?: { message: string }[];
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of [services.schedules, services.exams, services.homeworks]) {
    mock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
  }
});

it("graphql.calendar-date-filter-normalization", async () => {
  for (const [date, expected] of [
    ["2026-04-29T00:00:00+08:00", "2026-04-29T00:00:00.000Z"],
    ["2026-04-28T16:00:00Z", "2026-04-29T00:00:00.000Z"],
    ["2026-04-29T16:00:00Z", "2026-04-30T00:00:00.000Z"],
  ]) {
    for (const [field, service] of [
      ["schedules", services.schedules],
      ["exams", services.exams],
    ] as const) {
      const result = await graphql({
        schema: graphqlSchema,
        source: `query Calendar($date: DateTime!) { workspace { ${field}(filter: { dateFrom: $date, dateTo: $date }) { pageInfo { total } } } }`,
        variableValues: { date },
        contextValue: {
          principal: { kind: "session", userId: "date-user" },
          locale: "zh-cn",
        },
      });
      expect(result.errors).toBeUndefined();
      expect(service).toHaveBeenLastCalledWith(
        "date-user",
        expect.objectContaining({
          dateFrom: new Date(expected),
          dateTo: new Date(expected),
        }),
      );
    }
  }
});

it("graphql.room-maps", async () => {
  for (const status of ["highlighted", "overview", "unavailable"]) {
    const map = {
      code: "3101",
      building: status === "highlighted" ? "3" : null,
      floor: status === "highlighted" ? "1" : null,
      status,
      imageUrl:
        status === "unavailable" ? null : "https://static.example/3101.png",
      sourceImageUrl:
        status === "unavailable" ? null : "https://static.example/3.png",
    };
    services.roomMap.mockResolvedValue(map);
    const result = await graphql({
      schema: graphqlSchema,
      source:
        '{ catalog { roomMap(code: "3101") { code building floor status imageUrl sourceImageUrl } } }',
      contextValue: { principal: { kind: "anonymous" }, locale: "zh-cn" },
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ catalog: { roomMap: map } });
    expect(services.roomMap).toHaveBeenLastCalledWith("3101");
  }
});

it("graphql.scoped-queries.community-read-boundary", async () => {
  const community = graphqlSchema.getType("Community");
  if (!community || !("getFields" in community))
    throw new Error("Community must be an object");
  expect(Object.keys(community.getFields())).toEqual(["user"]);
  for (const field of ["comments", "descriptions"]) {
    const result = await graphql({
      schema: graphqlSchema,
      source: `{ community { ${field} { id } } }`,
      contextValue: {
        principal: { kind: "session", userId: "community-user" },
      },
    });
    expect(result.data).toBeUndefined();
    expect(result.errors?.[0].message).toContain(
      `Cannot query field "${field}"`,
    );
  }
});

it("graphql.single-endpoint", async () => {
  const route = await import("@/routes/api/graphql/+server");
  expect(route.GET).toBe(route.POST);
  expect(route.OPTIONS).toBe(route.POST);
  for (const method of ["GET", "POST", "OPTIONS"] as const) {
    const request = new Request(
      `https://life.example/api/graphql${method === "GET" ? "?query=%7B__typename%7D" : ""}`,
      {
        method,
        headers: {
          "content-type": "application/json",
          origin: "https://client.example",
          ...(method === "OPTIONS"
            ? { "access-control-request-method": "POST" }
            : {}),
        },
        ...(method === "POST"
          ? { body: JSON.stringify({ query: "{__typename}" }) }
          : {}),
      },
    );
    const response = await route[method]({
      request,
      url: new URL(request.url),
      locals: { locale: "zh-cn", requestId: "single-endpoint" },
    } as Parameters<typeof route.POST>[0]);
    expect(response.status).toBe(method === "OPTIONS" ? 204 : 200);
    if (method !== "OPTIONS")
      expect(await response.json()).toEqual({ data: { __typename: "Query" } });
  }
});

it("graphql.source-metadata", async () => {
  const known = {
    activityStatusCode: "active",
    signupStatusCode: "open",
    requiresSignup: true,
    categoryCode: "campus",
    moduleCode: "club",
    formCode: "lecture",
    activityLevelCode: "university",
    departmentId: "department-source-id",
    upstreamOrganizerIds: ["source-organizer"],
    upstreamSponsorIds: ["source-sponsor"],
    tagIds: ["source-tag"],
    signupScopeCode: "graduate",
    signupDepartmentIds: ["source-department"],
    requiresSignupInfo: true,
    allowedAttachmentTypes: ["pdf"],
    isOnline: false,
    onlineMeetingInfo: null,
    externalSponsor: "Public sponsor",
  };
  for (const expected of [
    known,
    Object.fromEntries(
      Object.entries(known).map(([key, value]) => [
        key,
        Array.isArray(value) ? [] : null,
      ]),
    ),
  ]) {
    services.youngEvent.mockResolvedValue({
      ...expected,
      youngId: "opaque-event",
      signedUp: true,
      participantUserId: "private-account",
      privateEmail: "private@example.test",
    });
    const result = await graphql({
      schema: graphqlSchema,
      source: `{ catalog { youngEvent(youngId: "opaque-event") { ${Object.keys(known).join(" ")} } } }`,
      contextValue: { principal: { kind: "anonymous" }, locale: "zh-cn" },
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ catalog: { youngEvent: expected } });
    expect(services.youngEvent).toHaveBeenLastCalledWith("opaque-event");
    expect(JSON.stringify(result)).not.toContain("private-account");
    expect(JSON.stringify(result)).not.toContain("private@example.test");
  }
  for (const field of ["signedUp", "participantUserId", "privateEmail"]) {
    const result = await graphql({
      schema: graphqlSchema,
      source: `{ catalog { youngEvent(youngId: "opaque-event") { ${field} } } }`,
      contextValue: { principal: { kind: "anonymous" } },
    });
    expect(result.data).toBeUndefined();
    expect(result.errors?.[0].message).toContain(
      `Cannot query field "${field}"`,
    );
  }
});

it("graphql.section-source-metadata", async () => {
  const expected = {
    requiredWeeks: 16,
    catalogAdminClasses: [{ nameCn: "2024班", nameEn: null }],
  };
  services.sections.mockResolvedValue({
    data: [
      {
        ...expected,
        catalogAdminClasses: [
          {
            ...expected.catalogAdminClasses[0],
            id: 71,
            privateMemberUserId: "private-account",
          },
        ],
      },
    ],
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  });
  const result = await graphql({
    schema: graphqlSchema,
    source:
      "{ catalog { sections { items { requiredWeeks catalogAdminClasses { nameCn nameEn } } } } }",
    contextValue: { principal: { kind: "anonymous" }, locale: "zh-cn" },
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ catalog: { sections: { items: [expected] } } });
  const type = graphqlSchema.getType("CatalogClassName");
  if (!type || !("getFields" in type))
    throw new Error("Missing catalog class names");
  expect(Object.keys(type.getFields()).sort()).toEqual(["nameCn", "nameEn"]);
});

it("graphql.exam-source-metadata", async () => {
  const expected = {
    grades: "2024",
    adminClassNames: "Class A",
    monitors: [{ jwId: 901, nameCn: "公开监考姓名", nameEn: null }],
  };
  services.exams.mockResolvedValue({
    data: [
      {
        ...expected,
        monitors: [
          {
            ...expected.monitors[0],
            id: "private-account",
            email: "private@example.test",
            phone: "private-phone",
          },
        ],
      },
    ],
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  });
  const result = await graphql({
    schema: graphqlSchema,
    source:
      "{ workspace { exams { items { grades adminClassNames monitors { jwId nameCn nameEn } } } } }",
    contextValue: {
      principal: { kind: "session", userId: "exam-viewer" },
      locale: "zh-cn",
    },
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ workspace: { exams: { items: [expected] } } });
  const type = graphqlSchema.getType("ExamMonitor");
  if (!type || !("getFields" in type))
    throw new Error("Missing exam monitor metadata");
  expect(Object.keys(type.getFields()).sort()).toEqual([
    "jwId",
    "nameCn",
    "nameEn",
  ]);
  for (const privateValue of [
    "private-account",
    "private@example.test",
    "private-phone",
  ])
    expect(JSON.stringify(result)).not.toContain(privateValue);
});
