import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetSitemapCacheForTest,
  SITEMAP_RUNTIME_CACHE_TTL_MS,
} from "@/features/catalog/server/sitemap-cache";

const { courseFindManyMock, sectionFindManyMock, teacherFindManyMock } =
  vi.hoisted(() => ({
    courseFindManyMock: vi.fn(),
    sectionFindManyMock: vi.fn(),
    teacherFindManyMock: vi.fn(),
  }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: { findMany: courseFindManyMock },
    section: { findMany: sectionFindManyMock },
    teacher: { findMany: teacherFindManyMock },
  },
}));

vi.mock("@/lib/site-url", () => ({
  getCanonicalOrigin: () => "https://life.example",
}));

import { GET } from "@/routes/sitemap.xml/+server";

function getSitemap(headers?: HeadersInit) {
  return GET({
    request: new Request("https://life.example/sitemap.xml", { headers }),
  } as never) as Promise<Response>;
}

describe("sitemap route", () => {
  beforeEach(() => {
    resetSitemapCacheForTest();
    courseFindManyMock.mockReset().mockResolvedValue([{ jwId: "CS100" }]);
    sectionFindManyMock.mockReset().mockResolvedValue([{ jwId: "CS100-01" }]);
    teacherFindManyMock.mockReset().mockResolvedValue([{ id: 42 }]);
  });

  afterEach(() => {
    resetSitemapCacheForTest();
    vi.useRealTimers();
  });

  it("preserves canonical URLs and excludes retired Sections", async () => {
    const response = await getSitemap();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(
      Array.from(body.matchAll(/<loc>(.+)<\/loc>/g), (match) => match[1]),
    ).toEqual([
      "https://life.example/",
      "https://life.example/courses",
      "https://life.example/sections",
      "https://life.example/teachers",
      "https://life.example/bus-map",
      "https://life.example/api/docs/tag/sections",
      "https://life.example/privacy",
      "https://life.example/terms",
      "https://life.example/courses/CS100",
      "https://life.example/sections/CS100-01",
      "https://life.example/teachers/42",
    ]);
    expect(sectionFindManyMock).toHaveBeenCalledWith({
      where: { retiredAt: null },
      select: { jwId: true },
    });
  });

  it("reuses a successful generation within the runtime TTL", async () => {
    await getSitemap();
    await getSitemap();

    expect(courseFindManyMock).toHaveBeenCalledTimes(1);
    expect(sectionFindManyMock).toHaveBeenCalledTimes(1);
    expect(teacherFindManyMock).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent cache misses", async () => {
    let resolveCourses: ((courses: { jwId: string }[]) => void) | undefined;
    courseFindManyMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCourses = resolve;
      }),
    );

    const first = getSitemap();
    const second = getSitemap();
    resolveCourses?.([{ jwId: "CS100" }]);
    await Promise.all([first, second]);

    expect(courseFindManyMock).toHaveBeenCalledTimes(1);
    expect(sectionFindManyMock).toHaveBeenCalledTimes(1);
    expect(teacherFindManyMock).toHaveBeenCalledTimes(1);
  });

  it("regenerates after the runtime TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T00:00:00.000Z"));

    await getSitemap();
    vi.setSystemTime(
      new Date(
        new Date("2026-07-19T00:00:00.000Z").getTime() +
          SITEMAP_RUNTIME_CACHE_TTL_MS +
          1,
      ),
    );
    await getSitemap();

    expect(courseFindManyMock).toHaveBeenCalledTimes(2);
    expect(sectionFindManyMock).toHaveBeenCalledTimes(2);
    expect(teacherFindManyMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache failed generations", async () => {
    courseFindManyMock
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce([{ jwId: "CS100" }]);

    await expect(getSitemap()).rejects.toThrow("database unavailable");
    await expect(getSitemap()).resolves.toHaveProperty("status", 200);

    expect(courseFindManyMock).toHaveBeenCalledTimes(2);
  });

  it("returns edge cache headers and supports conditional requests", async () => {
    const first = await getSitemap();
    const etag = first.headers.get("ETag");

    expect(etag).toMatch(/^"sha256-[A-Za-z0-9_-]+"$/);
    expect(first.headers.get("Cache-Control")).toBe(
      "public, max-age=0, must-revalidate",
    );
    expect(first.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "public, max-age=3600, stale-while-revalidate=21600",
    );
    expect(first.headers.get("Content-Type")).toBe(
      "application/xml; charset=utf-8",
    );

    const conditional = await getSitemap({
      "If-None-Match": `"other", W/${etag}`,
    });

    expect(conditional.status).toBe(304);
    expect(await conditional.text()).toBe("");
    expect(conditional.headers.get("ETag")).toBe(etag);
    expect(courseFindManyMock).toHaveBeenCalledTimes(1);
  });
});
