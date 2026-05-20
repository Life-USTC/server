import { type APIRequestContext, expect } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { absoluteTestUrl } from "../../../utils/request-url";
import { resolveSeedSectionMatch } from "../../../utils/seed-lookups";

type ApiContractCase = {
  routePath: string;
  baseURL?: string;
};

const probeOnlyRoutes = new Set([
  "/api/homeworks",
  "/api/homeworks/[id]",
  "/api/homeworks/[id]/completion",
  "/api/todos/[id]",
  "/api/uploads",
  "/api/uploads/[id]",
  "/api/uploads/[id]/download",
  "/api/uploads/complete",
  "/api/calendar-subscriptions",
  "/api/calendar-subscriptions/current",
  "/api/admin/comments",
  "/api/admin/comments/[id]",
  "/api/admin/users",
  "/api/admin/users/[id]",
  "/api/admin/suspensions",
  "/api/admin/suspensions/[id]",
  "/api/users/[userId]/calendar.ics",
  "/api/dashboard-links/pin",
  "/api/dashboard-links/visit",
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
  expect(await response.text()).toContain("BEGIN:VCALENDAR");
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
    case "/api/sections": {
      const response = await request.get("/api/sections?limit=20");
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

    case "/api/sections/[jwId]": {
      const response = await request.get(
        `/api/sections/${DEV_SEED.section.jwId}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as { jwId?: number; code?: string };
      expect(body.jwId).toBe(DEV_SEED.section.jwId);
      expect(body.code).toBe(DEV_SEED.section.code);
      return;
    }

    case "/api/sections/[jwId]/schedules": {
      const response = await request.get(
        `/api/sections/${DEV_SEED.section.jwId}/schedules`,
      );
      expect(response.status()).toBe(200);
      expect(
        ((await response.json()) as Array<{ id?: number }>).length,
      ).toBeGreaterThan(0);
      return;
    }

    case "/api/sections/[jwId]/schedule-groups": {
      const response = await request.get(
        `/api/sections/${DEV_SEED.section.jwId}/schedule-groups`,
      );
      expect(response.status()).toBe(200);
      expect(
        ((await response.json()) as Array<{ schedules?: unknown[] }>).length,
      ).toBeGreaterThan(0);
      return;
    }

    case "/api/sections/[jwId]/calendar.ics": {
      await expectCalendarResponse(
        await request.get(
          `/api/sections/${DEV_SEED.section.jwId}/calendar.ics`,
        ),
      );
      return;
    }

    case "/api/sections/calendar.ics": {
      const section = await resolveSeedSectionMatch(request);
      await expectCalendarResponse(
        await request.get(
          `/api/sections/calendar.ics?sectionIds=${section.id}`,
        ),
      );
      return;
    }

    case "/api/sections/match-codes": {
      const response = await request.post("/api/sections/match-codes", {
        data: { codes: [DEV_SEED.section.code] },
      });
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        matchedCodes?: string[];
        total?: number;
      };
      expect(body.matchedCodes?.includes(DEV_SEED.section.code)).toBe(true);
      expect((body.total ?? 0) > 0).toBe(true);
      return;
    }

    case "/api/teachers": {
      const response = await request.get(
        `/api/teachers?search=${encodeURIComponent(DEV_SEED.teacher.nameCn)}`,
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

    case "/api/courses": {
      const response = await request.get(
        `/api/courses?search=${encodeURIComponent(DEV_SEED.course.code)}`,
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

    case "/api/schedules": {
      const section = await resolveSeedSectionMatch(request);
      const response = await request.get(
        `/api/schedules?sectionId=${section.id}`,
      );
      expect(response.status()).toBe(200);
      expect(
        (((await response.json()) as { data?: unknown[] }).data?.length ?? 0) >
          0,
      ).toBe(true);
      return;
    }

    case "/api/semesters/current": {
      const response = await request.get("/api/semesters/current");
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

    case "/api/semesters": {
      const response = await request.get("/api/semesters?limit=20");
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

    case "/api/metadata": {
      const response = await request.get("/api/metadata");
      expect(response.status()).toBe(200);
      expect(
        (((await response.json()) as { campuses?: unknown[] }).campuses
          ?.length ?? 0) > 0,
      ).toBe(true);
      return;
    }

    case "/api/comments": {
      const section = await resolveSeedSectionMatch(request);
      const response = await request.get(
        `/api/comments?targetType=section&targetId=${section.id}`,
      );
      expect(response.status()).toBe(200);
      const body = (await response.json()) as {
        comments?: Array<{ body?: string }>;
      };
      expect(
        body.comments?.some((entry) =>
          entry.body?.includes(DEV_SEED.comments.sectionRootBody),
        ),
      ).toBe(true);
      return;
    }

    case "/api/descriptions": {
      const section = await resolveSeedSectionMatch(request);
      const response = await request.get(
        `/api/descriptions?targetType=section&targetId=${section.id}`,
      );
      expect(response.status()).toBe(200);
      expect(
        ((await response.json()) as { description?: { content?: string } })
          .description?.content,
      ).toContain("课程建议");
      return;
    }

    case "/api/todos": {
      const response = await request.get("/api/todos");
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

    case "/api/locale": {
      const response = await fetch(absoluteTestUrl("/api/locale", baseURL), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ locale: "zh-cn" }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie")).toContain("NEXT_LOCALE=zh-cn");
      return;
    }

    case "/api/auth/[...auth]": {
      const response = await request.get("/api/auth/get-session");
      expect(response.status()).toBe(200);
      return;
    }

    case "/api/comments/[id]":
    case "/api/comments/[id]/reactions": {
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

      const fallbackResponse = await request.get(
        routePath
          .replace("[id]", "invalid-e2e")
          .replace("[userId]", "invalid-e2e")
          .replace("[jwId]", "invalid-e2e")
          .replace("[...auth]", "session"),
      );
      expectSuccessfulResponse(fallbackResponse);
    }
  }
}
