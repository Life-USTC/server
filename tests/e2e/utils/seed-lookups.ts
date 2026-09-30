import { type APIRequestContext, expect, type Page } from "@playwright/test";
import { DEV_SEED } from "./dev-seed";

type SeedSectionMatch = {
  id: number;
  jwId: number | null;
  code: string;
};

function getRequestContext(source: APIRequestContext | Page) {
  return "request" in source ? source.request : source;
}

export async function resolveSeedSectionMatch(
  source: APIRequestContext | Page,
): Promise<SeedSectionMatch> {
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
}

export async function resolveSeedSectionId(source: APIRequestContext | Page) {
  return (await resolveSeedSectionMatch(source)).id;
}

export async function resolveSeedTeacherId(
  source: APIRequestContext | Page,
): Promise<number> {
  const response = await getRequestContext(source).get(
    `/api/catalog/teachers?search=${encodeURIComponent(DEV_SEED.teacher.code)}&pageSize=10`,
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
}
