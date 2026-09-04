import { type APIRequestContext, expect } from "@playwright/test";
import { DEV_SEED } from "../../../e2e/utils/dev-seed";
import { absoluteTestUrl } from "../../../e2e/utils/request-url";
import { resolveSeedSectionMatch } from "../../../e2e/utils/seed-lookups";

type ApiContractCase = {
  routePath: string;
  baseURL?: string;
};

export function expectCalendarDtstampsAreUtc(calendar: string) {
  const dtstamps = calendar
    .split(/\r?\n/)
    .filter((line) => line.startsWith("DTSTAMP:"));

  expect(dtstamps.length).toBeGreaterThan(0);
  for (const dtstamp of dtstamps) {
    expect(dtstamp).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/);
  }
}

/**
 * Routes that still lack a dedicated suite under `tests/integration/rest/`.
 * Prefer status + body-shape cases in `assertApiContract` over this set.
 * Do not list routes that already have a real REST suite.
 */
const probeOnlyRoutes = new Set<string>([]);

function expectSuccessfulResponse(
  response: Awaited<ReturnType<APIRequestContext["get"]>>,
) {
  expect(response.status()).toBeGreaterThan(0);
  expect(response.status()).toBeLessThan(500);
}

async function expectCalendarResponse(
  response: Awaited<ReturnType<APIRequestContext["get"]>>,
) {
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/calendar");
  const calendar = await response.text();
  expect(calendar).toContain("BEGIN:VCALENDAR");
  expectCalendarDtstampsAreUtc(calendar);
}

async function expectProbeRoute(
  request: APIRequestContext,
  routePath: string,
  expectedStatuses: number[] = [400, 401, 403, 404, 405],
) {
  const probePath = routePath
    .replace("[id]", "invalid-e2e")
    .replace("[userId]", "invalid-e2e")
    .replace("[jwId]", String(DEV_SEED.section.jwId));
  const response = await request.get(probePath);
  expectSuccessfulResponse(response);
  expect(expectedStatuses).toContain(response.status());
}

export async function assertApiContract(
  request: APIRequestContext,
  { routePath, baseURL }: ApiContractCase,
) {
  switch (routePath) {
    case "/api/catalog/sections": {
      const response = await request.get("/api/catalog/sections?limit=20");
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        data?: Array<{
          id?: number;
          jwId?: number;
          code?: string;
          course?: { nameCn?: string };
        }>;
      };
      expect((body.data?.length ?? 0) > 0).toBe(true);
      const first = body.data?.[0];
      if (first) {
        expect(typeof first.id).toBe("number");
        expect(typeof first.jwId).toBe("number");
        expect(typeof first.code).toBe("string");
        expect(first.course).toBeDefined();
        expect(typeof first.course?.nameCn).toBe("string");
      }
      expect((await resolveSeedSectionMatch(request)).code).toBe(
        DEV_SEED.section.code,
      );
      return;
    }

    case "/api/catalog/sections/[jwId]": {
      const response = await request.get(
        `/api/catalog/sections/${DEV_SEED.section.jwId}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as { jwId?: number; code?: string };
      expect(body.jwId).toBe(DEV_SEED.section.jwId);
      expect(body.code).toBe(DEV_SEED.section.code);
      return;
    }

    case "/api/catalog/sections/[jwId]/schedules": {
      const response = await request.get(
        `/api/catalog/sections/${DEV_SEED.section.jwId}/schedules`,
      );
      expect(response.status()).toBe(200);
      expect(
        ((await response.json()) as Array<{ id?: number }>).length,
      ).toBeGreaterThan(0);
      return;
    }

    case "/api/catalog/sections/[jwId]/schedule-groups": {
      const response = await request.get(
        `/api/catalog/sections/${DEV_SEED.section.jwId}/schedule-groups`,
      );
      expect(response.status()).toBe(200);
      expect(
        ((await response.json()) as Array<{ schedules?: unknown[] }>).length,
      ).toBeGreaterThan(0);
      return;
    }

    case "/api/catalog/sections/[jwId]/calendar.ics": {
      await expectCalendarResponse(
        await request.get(
          `/api/catalog/sections/${DEV_SEED.section.jwId}/calendar.ics`,
        ),
      );
      return;
    }

    case "/api/catalog/sections/calendar.ics": {
      const section = await resolveSeedSectionMatch(request);
      await expectCalendarResponse(
        await request.get(
          `/api/catalog/sections/calendar.ics?sectionIds=${section.id}`,
        ),
      );
      return;
    }

    case "/api/catalog/sections/match-codes": {
      const response = await request.post("/api/catalog/sections/match-codes", {
        data: { codes: [DEV_SEED.section.code] },
      });
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        matchedCodes?: string[];
        suggestions?: Record<string, string[]>;
        total?: number;
      };
      expect(body.matchedCodes?.includes(DEV_SEED.section.code)).toBe(true);
      expect(body.suggestions).toBeDefined();
      expect((body.total ?? 0) > 0).toBe(true);
      return;
    }

    case "/api/community/users/[identifier]": {
      const response = await request.get(
        `/api/community/users/${DEV_SEED.debugUsername}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        user?: {
          id?: string;
          name?: string | null;
          username?: string | null;
          _count?: {
            comments?: number;
            homeworksCreated?: number;
            subscribedSections?: number;
            uploads?: number;
          };
        };
        sectionCount?: number;
        totalContributions?: number;
        weeks?: unknown[];
      };
      expect(body.user?.id).toBeTruthy();
      expect(body.user?.name).toBe(DEV_SEED.debugName);
      expect(body.user?.username).toBe(DEV_SEED.debugUsername);
      expect(typeof body.sectionCount).toBe("number");
      expect(typeof body.totalContributions).toBe("number");
      expect(Array.isArray(body.weeks)).toBe(true);
      expect(typeof body.user?._count?.comments).toBe("number");
      expect(typeof body.user?._count?.uploads).toBe("number");
      expect(typeof body.user?._count?.homeworksCreated).toBe("number");
      expect(typeof body.user?._count?.subscribedSections).toBe("number");
      return;
    }

    case "/api/catalog/teachers": {
      const response = await request.get(
        `/api/catalog/teachers?search=${encodeURIComponent(DEV_SEED.teacher.nameCn)}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        data?: Array<{ nameCn?: string; _count?: { sections?: number } }>;
      };
      const teacher = body.data?.find((entry) =>
        entry.nameCn?.includes(DEV_SEED.teacher.nameCn),
      );
      expect(teacher).toBeDefined();
      expect(typeof teacher?.nameCn).toBe("string");
      expect(teacher?._count).toBeDefined();
      return;
    }

    case "/api/catalog/courses": {
      const response = await request.get(
        `/api/catalog/courses?search=${encodeURIComponent(DEV_SEED.course.code)}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        data?: Array<{
          id?: number;
          jwId?: number | null;
          code?: string;
          nameCn?: string;
        }>;
      };
      expect(
        body.data?.some(
          (entry) =>
            entry.jwId === DEV_SEED.course.jwId &&
            entry.nameCn === DEV_SEED.course.nameCn,
        ),
      ).toBe(true);
      const first = body.data?.[0];
      if (first) {
        expect(typeof first.id).toBe("number");
        expect(typeof first.jwId).toBe("number");
        expect(typeof first.code).toBe("string");
        expect(typeof first.nameCn).toBe("string");
      }
      return;
    }

    case "/api/catalog/courses/[jwId]": {
      const response = await request.get(
        `/api/catalog/courses/${DEV_SEED.course.jwId}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        jwId?: number | null;
        nameCn?: string | null;
      };
      expect(body.jwId).toBe(DEV_SEED.course.jwId);
      expect(body.nameCn).toBe(DEV_SEED.course.nameCn);
      return;
    }

    case "/api/catalog/teachers/[id]": {
      const searchResponse = await request.get(
        `/api/catalog/teachers?search=${encodeURIComponent(DEV_SEED.teacher.nameCn)}`,
      );
      expect(searchResponse.status()).toBe(200);
      const searchBody = (await searchResponse.json()) as {
        data?: Array<{ id?: number; nameCn?: string }>;
      };
      const teacher = searchBody.data?.find((entry) =>
        entry.nameCn?.includes(DEV_SEED.teacher.nameCn),
      );
      expect(teacher?.id).toBeDefined();

      const response = await request.get(
        `/api/catalog/teachers/${teacher?.id}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as { nameCn?: string | null };
      expect(body.nameCn).toContain(DEV_SEED.teacher.nameCn);
      return;
    }

    case "/api/catalog/schedules": {
      const section = await resolveSeedSectionMatch(request);
      const response = await request.get(
        `/api/catalog/schedules?sectionId=${section.id}`,
      );
      expect(response.status()).toBe(200);
      expect(
        (((await response.json()) as { data?: unknown[] }).data?.length ?? 0) >
          0,
      ).toBe(true);
      return;
    }

    case "/api/catalog/bus/routes": {
      const response = await request.get(
        `/api/catalog/bus/routes?originCampusId=${DEV_SEED.bus.originCampusId}&destinationCampusId=${DEV_SEED.bus.destinationCampusId}&versionKey=${DEV_SEED.bus.versionKey}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        routes?: Array<{ id?: number; stops?: unknown[] }>;
        total?: number;
      };
      expect((body.total ?? 0) > 0).toBe(true);
      expect(
        body.routes?.some((route) => route.id === DEV_SEED.bus.routeId),
      ).toBe(true);
      return;
    }

    case "/api/catalog/bus/next": {
      const response = await request.get(
        `/api/catalog/bus/next?originCampusId=${DEV_SEED.bus.originCampusId}&destinationCampusId=${DEV_SEED.bus.destinationCampusId}&atTime=${encodeURIComponent(DEV_SEED.seedAnchorAtTime)}&dayType=weekday&versionKey=${DEV_SEED.bus.versionKey}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        departures?: Array<{ routeId?: number; status?: string }>;
      };
      expect((body.departures?.length ?? 0) > 0).toBe(true);
      expect(body.departures?.[0]?.status).toBe("upcoming");
      return;
    }

    case "/api/catalog/semesters/current": {
      const response = await request.get("/api/catalog/semesters/current");
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        jwId?: number;
        nameCn?: string;
        code?: string;
      };
      // semester.yml current-semester.display.fields
      expect(body.jwId).toBe(DEV_SEED.semesterJwId);
      expect(body.nameCn).toBe(DEV_SEED.semesterNameCn);
      expect(typeof body.nameCn).toBe("string");
      expect(typeof body.code).toBe("string");
      return;
    }

    case "/api/catalog/semesters": {
      const response = await request.get("/api/catalog/semesters?limit=20");
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        data?: Array<{
          jwId?: number;
          nameCn?: string;
          code?: string;
        }>;
      };
      const semester = body.data?.find(
        (entry) => entry.jwId === DEV_SEED.semesterJwId,
      );
      expect(semester).toBeDefined();
      // semester.yml semester-list.display.fields
      expect(typeof semester?.nameCn).toBe("string");
      expect(typeof semester?.code).toBe("string");
      return;
    }

    case "/api/catalog/metadata": {
      const response = await request.get("/api/catalog/metadata");
      expect(response.status()).toBe(200);
      expect(
        (((await response.json()) as { campuses?: unknown[] }).campuses
          ?.length ?? 0) > 0,
      ).toBe(true);
      return;
    }

    case "/api/catalog/young-events": {
      const response = await request.get(
        `/api/catalog/young-events?search=${encodeURIComponent(DEV_SEED.youngEvent.name)}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        data?: Array<{
          youngId?: string;
          name?: string;
          category?: string | null;
          isActive?: boolean;
        }>;
        pagination?: { page?: number; total?: number; totalPages?: number };
      };
      expect(typeof body.pagination?.page).toBe("number");
      expect(typeof body.pagination?.total).toBe("number");
      expect(body.pagination?.totalPages).toBeGreaterThanOrEqual(1);
      const event = body.data?.find(
        (entry) => entry.youngId === DEV_SEED.youngEvent.youngId,
      );
      expect(event).toBeDefined();
      expect(event?.name).toBe(DEV_SEED.youngEvent.name);
      expect(event?.category).toBe(DEV_SEED.youngEvent.category);
      expect(event?.isActive).toBe(true);
      return;
    }

    case "/api/catalog/young-events/[youngId]": {
      const response = await request.get(
        `/api/catalog/young-events/${DEV_SEED.youngEvent.youngId}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        youngId?: string;
        name?: string;
        rawJson?: unknown;
      };
      expect(body.youngId).toBe(DEV_SEED.youngEvent.youngId);
      expect(body.name).toBe(DEV_SEED.youngEvent.name);
      expect(body.rawJson).toBeDefined();
      const missing = await request.get(
        "/api/catalog/young-events/invalid-e2e",
      );
      expect(missing.status()).toBe(404);
      return;
    }

    case "/api/community/comments": {
      const section = await resolveSeedSectionMatch(request);
      const response = await request.get(
        `/api/community/comments?targetType=section&targetId=${section.id}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        data?: Array<{ body?: string }>;
        pagination?: { total?: number };
      };
      expect(
        body.data?.some((entry) =>
          entry.body?.includes(DEV_SEED.comments.sectionRootBody),
        ),
      ).toBe(true);
      expect(typeof body.pagination?.total).toBe("number");
      return;
    }

    case "/api/community/descriptions": {
      const section = await resolveSeedSectionMatch(request);
      const response = await request.get(
        `/api/community/descriptions?targetType=section&targetId=${section.id}`,
      );
      expect(response.status()).toBe(200);
      expect(
        ((await response.json()) as { description?: { content?: string } })
          .description?.content,
      ).toContain("课程建议");
      return;
    }

    case "/api/workspace/todos": {
      const response = await request.get("/api/workspace/todos");
      expect(response.status()).toBe(401);
      return;
    }

    case "/api/openapi": {
      const response = await request.get("/api/openapi");
      expect(response.status()).toBe(200);
      expect(((await response.json()) as { openapi?: string }).openapi).toBe(
        "3.0.0",
      );
      return;
    }

    case "/api/account/preferences": {
      const response = await fetch(
        absoluteTestUrl("/api/account/preferences", baseURL),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ locale: "zh-cn" }),
        },
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie")).toContain("NEXT_LOCALE=zh-cn");
      return;
    }

    case "/api/auth/[...auth]": {
      const response = await request.get("/api/auth/get-session");
      expect(response.status()).toBe(200);
      return;
    }

    case "/api/community/comments/[id]":
    case "/api/community/comments/[id]/replies":
    case "/api/community/comments/[id]/reactions": {
      const response = await request.get(
        routePath.replace("[id]", "invalid-e2e"),
      );
      expectSuccessfulResponse(response);
      return;
    }

    case "/api/admin/comments":
    case "/api/admin/descriptions":
    case "/api/admin/homeworks":
    case "/api/admin/suspensions":
    case "/api/admin/users": {
      const response = await request.get(routePath);
      expect(response.status()).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(typeof body.error).toBe("string");
      return;
    }

    case "/api/admin/comments/[id]":
    case "/api/admin/descriptions/[id]":
    case "/api/admin/homeworks/[id]":
    case "/api/admin/suspensions/[id]":
    case "/api/admin/users/[id]": {
      const response = await request.get(
        routePath.replace("[id]", "invalid-e2e"),
      );
      expect(response.status()).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(typeof body.error).toBe("string");
      return;
    }

    case "/api/workspace/overview":
    case "/api/workspace/schedules":
    case "/api/workspace/homeworks":
    case "/api/workspace/homeworks/completions":
    case "/api/workspace/bus-preferences":
    case "/api/account/profile": {
      const response = await request.get(routePath);
      expect(response.status()).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(typeof body.error).toBe("string");
      return;
    }

    case "/api/workspace/todos/[id]":
    case "/api/workspace/uploads/[id]":
    case "/api/workspace/uploads/[id]/download":
    case "/api/workspace/homeworks/[id]/completion": {
      const response = await request.get(
        routePath.replace("[id]", "invalid-e2e"),
      );
      expect(response.status()).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(typeof body.error).toBe("string");
      return;
    }

    case "/api/workspace/uploads/complete":
    case "/api/workspace/uploads/object":
    case "/api/workspace/subscriptions":
    case "/api/workspace/subscriptions/import-codes": {
      const response = await request.post(routePath, {
        data: {},
      });
      expect(response.status()).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(typeof body.error).toBe("string");
      return;
    }

    case "/api/workspace/subscriptions/current": {
      const response = await request.get(routePath);
      expect(response.status()).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(typeof body.error).toBe("string");
      return;
    }

    case "/api/community/section-homeworks": {
      const response = await request.get(`${routePath}?sectionId=1&limit=5`);
      expect([200, 400, 401, 404]).toContain(response.status());
      expect(response.headers()["content-type"] ?? "").toContain(
        "application/json",
      );
      return;
    }

    case "/api/community/section-homeworks/audit": {
      const response = await request.get(routePath);
      expect([200, 400, 401, 404, 405]).toContain(response.status());
      expect(response.headers()["content-type"] ?? "").toContain(
        "application/json",
      );
      return;
    }

    case "/api/community/section-homeworks/[id]": {
      const response = await request.get(
        routePath.replace("[id]", "invalid-e2e"),
      );
      expect([400, 401, 404]).toContain(response.status());
      expect(response.headers()["content-type"] ?? "").toContain(
        "application/json",
      );
      return;
    }

    case "/api/calendar-feeds/[credential].ics": {
      const response = await request.get(
        routePath.replace("[credential]", "invalid-e2e"),
      );
      expect([400, 401, 403, 404]).toContain(response.status());
      return;
    }

    case "/api/auth/oauth2/device-authorization": {
      const response = await request.get(routePath);
      expect([400, 401, 404, 405]).toContain(response.status());
      return;
    }

    case "/api/auth/oauth2/token": {
      const response = await request.post(routePath, { data: {} });
      expect([400, 401]).toContain(response.status());
      expect(response.headers()["content-type"] ?? "").toContain(
        "application/json",
      );
      return;
    }

    case "/api/auth/.well-known/openid-configuration": {
      const response = await request.get(routePath);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as { issuer?: string };
      expect(typeof body.issuer).toBe("string");
      return;
    }

    case "/api/mcp": {
      const response = await request.get(routePath);
      expect([200, 401, 405, 406]).toContain(response.status());
      return;
    }

    case "/api/mcp/.well-known/oauth-authorization-server":
    case "/api/mcp/.well-known/openid-configuration": {
      const response = await request.get(routePath);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toEqual(expect.any(Object));
      expect(Object.keys(body).length).toBeGreaterThan(0);
      return;
    }

    case "/api/catalog/links/resolve": {
      const response = await request.get(
        `${routePath}?url=https://example.com`,
      );
      expect([200, 400, 404]).toContain(response.status());
      expect(response.headers()["content-type"] ?? "").toContain(
        "application/json",
      );
      return;
    }

    case "/api/health": {
      const response = await request.get(routePath);
      expect(response.status()).toBe(200);
      const body = (await response.json()) as { status?: string };
      expect(typeof body.status).toBe("string");
      return;
    }

    case "/api/catalog/bus":
    case "/api/catalog/weather": {
      const response = await request.get(routePath);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"] ?? "").toContain(
        "application/json",
      );
      return;
    }

    case "/api/workspace/uploads":
    case "/api/workspace/link-pins": {
      const response = await request.get(routePath);
      expect(response.status()).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(typeof body.error).toBe("string");
      return;
    }

    default: {
      if (probeOnlyRoutes.has(routePath)) {
        await expectProbeRoute(request, routePath);
        return;
      }

      throw new Error(`No API contract assertion registered for ${routePath}`);
    }
  }
}
