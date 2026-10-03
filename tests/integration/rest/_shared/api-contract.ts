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

async function expectUnauthorizedJson(
  response: Awaited<ReturnType<APIRequestContext["get"]>>,
) {
  expect(response.status()).toBe(401);
  const body = (await response.json()) as { error?: string };
  expect(typeof body.error).toBe("string");
}

function probePath(routePath: string) {
  return routePath
    .replace("[id]", "invalid-e2e")
    .replace("[userId]", "invalid-e2e")
    .replace("[jwId]", String(DEV_SEED.section.jwId));
}

export async function assertApiContract(
  request: APIRequestContext,
  { routePath, baseURL }: ApiContractCase,
) {
  switch (routePath) {
    case "/api/catalog/sections": {
      const response = await request.get("/api/catalog/sections?pageSize=20");
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
    case "/api/community/comments/[id]/replies": {
      const response = await request.get(
        routePath.replace("[id]", "invalid-e2e"),
      );
      expectSuccessfulResponse(response);
      return;
    }

    case "/api/admin/comments":
    case "/api/admin/suspensions":
    case "/api/admin/users": {
      await expectUnauthorizedJson(await request.get(routePath));
      return;
    }

    case "/api/admin/comments/[id]":
    case "/api/admin/suspensions/[id]":
    case "/api/admin/users/[id]": {
      await expectUnauthorizedJson(
        await request.patch(probePath(routePath), { data: {} }),
      );
      return;
    }

    default: {
      throw new Error(`No API contract assertion registered for ${routePath}`);
    }
  }
}
