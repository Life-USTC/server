import { afterEach, describe, expect, it, vi } from "vitest";
import { setContentSignal } from "@/lib/seo/content-signal";
import { GET as getLlmsTxt } from "@/routes/llms.txt/+server";
import { GET as getRobotsTxt } from "@/routes/robots.txt/+server";
import { GET as getSitemapXml } from "@/routes/sitemap.xml/+server";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    course: {
      findMany: vi.fn(async () => [{ jwId: "course-1" }]),
    },
    section: {
      findMany: vi.fn(async () => [{ jwId: "section-1" }]),
    },
    teacher: {
      findMany: vi.fn(async () => [{ id: 1 }]),
    },
  },
}));

const ORIGIN = "https://life.example";
const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("crawler discovery routes", () => {
  it("sets the shared content-use policy", () => {
    const headers = new Headers();
    setContentSignal(headers);

    expect(headers.get("Content-Signal")).toBe(CONTENT_SIGNAL);
  });

  it("generates a precise robots policy with an absolute sitemap", async () => {
    vi.stubEnv("APP_CANONICAL_ORIGIN", ORIGIN);

    const response = await getRobotsTxt({} as never);
    const body = await response.text();

    expect(response.headers.get("Content-Signal")).toBe(CONTENT_SIGNAL);
    expect(body).toContain("Allow: /api/docs$\nAllow: /api/docs/");
    expect(body).toContain("Disallow: /api$\nDisallow: /api/");
    for (const path of ["admin", "oauth", "settings", "signin", "welcome"]) {
      expect(body).toContain(`Disallow: /${path}$\nDisallow: /${path}/`);
    }
    expect(body).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    expect(body).not.toContain("Sitemap: /sitemap.xml");
  });

  it("lists only stable public discovery and protocol links", async () => {
    vi.stubEnv("APP_CANONICAL_ORIGIN", ORIGIN);

    const response = await getLlmsTxt({} as never);
    const body = await response.text();

    expect(response.headers.get("Content-Signal")).toBe(CONTENT_SIGNAL);
    expect(body).toContain(`${ORIGIN}/courses`);
    expect(body).toContain(`${ORIGIN}/sections`);
    expect(body).toContain(`${ORIGIN}/teachers`);
    expect(body).toContain(`${ORIGIN}/api/docs/tag/sections`);
    expect(body).toContain(
      `${ORIGIN}/.well-known/oauth-protected-resource/api/mcp`,
    );
    expect(body).toContain(`${ORIGIN}/api/mcp`);
    expect(body).toContain(`${ORIGIN}/sitemap.xml`);
    expect(body).not.toMatch(/\/(?:admin|settings|signin|welcome)(?:[/)\s]|$)/);
  });

  it("adds the content-use policy to the sitemap", async () => {
    vi.stubEnv("APP_CANONICAL_ORIGIN", ORIGIN);

    const response = await getSitemapXml({
      request: new Request(`${ORIGIN}/sitemap.xml`),
    } as never);
    const body = await response.text();

    expect(response.headers.get("Content-Signal")).toBe(CONTENT_SIGNAL);
    expect(body).toContain(`<loc>${ORIGIN}/api/docs/tag/sections</loc>`);
    expect(body).toContain(`<loc>${ORIGIN}/courses/course-1</loc>`);
    expect(body).toContain(`<loc>${ORIGIN}/sections/section-1</loc>`);
    expect(body).toContain(`<loc>${ORIGIN}/teachers/1</loc>`);
  });
});
