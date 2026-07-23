import { type APIRequestContext, expect } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { absoluteTestUrl } from "../../../utils/request-url";
import { resolveSeedSectionMatch } from "../../../utils/seed-lookups";

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

const probeOnlyRoutes = new Set([
  "/api/admin/comments",
  "/api/admin/comments/[id]",
  "/api/admin/descriptions",
  "/api/admin/descriptions/[id]",
  "/api/admin/homeworks",
  "/api/admin/homeworks/[id]",
  "/api/admin/suspensions",
  "/api/admin/suspensions/[id]",
  "/api/admin/users",
  "/api/admin/users/[id]",
  "/api/auth/oauth2/device-authorization",
  "/api/auth/oauth2/token",
  "/api/auth/.well-known/openid-configuration",
  "/api/catalog/bus",
  "/api/workspace/bus-preferences",
  "/api/workspace/subscriptions",
  "/api/workspace/subscriptions/current",
  "/api/workspace/subscriptions/import-codes",
  "/api/workspace/link-pins",
  "/api/catalog/links/resolve",
  "/api/health",
  "/api/community/section-homeworks",
  "/api/workspace/homeworks/completions",
  "/api/community/section-homeworks/[id]",
  "/api/workspace/homeworks/[id]/completion",
  "/api/mcp",
  "/api/mcp/.well-known/oauth-authorization-server",
  "/api/mcp/.well-known/openid-configuration",
  "/api/account/profile",
  "/api/workspace/overview",
  "/api/workspace/homeworks",
  "/api/workspace/schedules",
  "/api/workspace/todos/[id]",
  "/api/workspace/uploads",
  "/api/workspace/uploads/complete",
  "/api/workspace/uploads/[id]",
  "/api/workspace/uploads/[id]/download",
  "/api/workspace/uploads/object",
  "/api/calendar-feeds/[userId].ics",
]);

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

    case "/api/account/profile": {
      const response = await request.get(
        `/api/account/profile?username=${DEV_SEED.debugUsername}`,
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
    case "/api/community/comments/[id]/reactions": {
      const response = await request.get(
        routePath.replace("[id]", "invalid-e2e"),
      );
      expectSuccessfulResponse(response);
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
