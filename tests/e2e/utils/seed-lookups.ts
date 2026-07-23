import { type APIRequestContext, expect, type Page } from "@playwright/test";
import { DEV_SEED } from "./dev-seed";

type SeedSectionMatch = {
  id: number;
  jwId: number | null;
  code: string;
};

let seedSectionMatchPromise: Promise<SeedSectionMatch> | undefined;
let seedSectionMatchesPromise: Promise<SeedSectionMatch[]> | undefined;
let seedTeacherIdPromise: Promise<number> | undefined;

function getRequestContext(source: APIRequestContext | Page) {
  return "request" in source ? source.request : source;
}

export async function resolveSeedSectionMatch(
  source: APIRequestContext | Page,
): Promise<SeedSectionMatch> {
  seedSectionMatchPromise ??= (async () => {
    const response = await getRequestContext(source).post(
      "/api/catalog/sections/match-codes",
      {
        data: { codes: [DEV_SEED.section.code] },
      },
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      sections?: Array<{
        id?: number;
        jwId?: number | null;
        code?: string | null;
      }>;
    };
    const section = body.sections?.find(
      (entry) =>
        typeof entry.id === "number" &&
        typeof entry.code === "string" &&
        entry.code === DEV_SEED.section.code,
    );

    if (
      !section ||
      typeof section.id !== "number" ||
      typeof section.code !== "string"
    ) {
      throw new Error(
        `Seed section ${DEV_SEED.section.code} not found via /api/catalog/sections/match-codes`,
      );
    }

    return { id: section.id, jwId: section.jwId ?? null, code: section.code };
  })();

  if (!seedSectionMatchPromise) {
    throw new Error("Seed section lookup did not initialize");
  }
  return seedSectionMatchPromise;
}

export async function resolveSeedSectionId(source: APIRequestContext | Page) {
  return (await resolveSeedSectionMatch(source)).id;
}

export async function resolveSeedSectionMatches(
  source: APIRequestContext | Page,
): Promise<SeedSectionMatch[]> {
  seedSectionMatchesPromise ??= (async () => {
    const seedCodes = DEV_SEED.sections.map((section) => section.code);
    const request = getRequestContext(source);
    const response = await request.post("/api/catalog/sections/match-codes", {
      data: { codes: seedCodes },
    });
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      sections?: Array<{
        id?: number;
        jwId?: number | null;
        code?: string | null;
      }>;
    };
    const sections = (body.sections ?? []).filter(
      (entry): entry is { id: number; jwId?: number | null; code: string } =>
        typeof entry.id === "number" &&
        typeof entry.code === "string" &&
        seedCodes.includes(entry.code),
    );

    const matchedCodeSet = new Set(sections.map((section) => section.code));
    for (const code of seedCodes.filter((item) => !matchedCodeSet.has(item))) {
      const fallbackResponse = await request.get(
        `/api/catalog/sections?search=${encodeURIComponent(code)}&limit=10`,
      );
      expect(fallbackResponse.status()).toBe(200);
      const fallbackBody = (await fallbackResponse.json()) as {
        data?: Array<{
          id?: number;
          jwId?: number | null;
          code?: string | null;
        }>;
      };
      const fallbackSection = fallbackBody.data?.find(
        (entry) =>
          typeof entry.id === "number" &&
          typeof entry.code === "string" &&
          entry.code === code,
      );
      if (fallbackSection?.id && fallbackSection.code) {
        sections.push({
          id: fallbackSection.id,
          jwId: fallbackSection.jwId ?? null,
          code: fallbackSection.code,
        });
      }
    }

    if (sections.length !== seedCodes.length) {
      throw new Error(
        `Expected ${seedCodes.length} seed sections, found ${sections.length}`,
      );
    }

    return sections.map((section) => ({
      id: section.id,
      jwId: section.jwId ?? null,
      code: section.code,
    }));
  })();

  return seedSectionMatchesPromise;
}

export async function resolveSeedTeacherId(
  source: APIRequestContext | Page,
): Promise<number> {
  seedTeacherIdPromise ??= (async () => {
    const response = await getRequestContext(source).get(
      `/api/catalog/teachers?search=${encodeURIComponent(DEV_SEED.teacher.code)}&limit=10`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      data?: Array<{ id?: number; code?: string | null }>;
    };
    const teacher = body.data?.find(
      (item) =>
        typeof item.id === "number" && item.code === DEV_SEED.teacher.code,
    );

    if (!teacher || typeof teacher.id !== "number") {
      throw new Error(
        `Seed teacher ${DEV_SEED.teacher.code} not found via /api/catalog/teachers`,
      );
    }

    return teacher.id;
  })();

  return seedTeacherIdPromise;
}
