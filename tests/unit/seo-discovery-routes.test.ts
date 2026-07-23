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

type DiscoveryHandler = (event: never) => Response | Promise<Response>;

function getDiscoveryDocument(
  handler: DiscoveryHandler,
  path: string,
  headers?: HeadersInit,
) {
  return Promise.resolve(
    handler({
      request: new Request(`${ORIGIN}/${path}`, { headers }),
    } as never),
  );
}

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

    const response = await getDiscoveryDocument(getRobotsTxt, "robots.txt");
    const body = await response.text();

    expect(response.headers.get("Content-Signal")).toBe(CONTENT_SIGNAL);
    expect(body).toContain("Allow: /api/docs$\nAllow: /api/docs/");
    expect(body).toContain("Disallow: /api$\nDisallow: /api/");
    for (const path of [
      "admin",
      "oauth",
      "account/settings",
      "account/sign-in",
      "account/welcome",
    ]) {
      expect(body).toContain(`Disallow: /${path}$\nDisallow: /${path}/`);
    }
    expect(body).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    expect(body).not.toContain("Sitemap: /sitemap.xml");
  });

  it("lists only stable public discovery and protocol links", async () => {
    vi.stubEnv("APP_CANONICAL_ORIGIN", ORIGIN);

    const response = await getDiscoveryDocument(getLlmsTxt, "llms.txt");
    const body = await response.text();

    expect(response.headers.get("Content-Signal")).toBe(CONTENT_SIGNAL);
    expect(body).toContain(`${ORIGIN}/catalog/courses`);
    expect(body).toContain(`${ORIGIN}/catalog/sections`);
    expect(body).toContain(`${ORIGIN}/catalog/teachers`);
    expect(body).toContain(`${ORIGIN}/api/docs/tag/sections`);
    expect(body).toContain(
      `${ORIGIN}/.well-known/oauth-protected-resource/api/mcp`,
    );
    expect(body).toContain(`${ORIGIN}/api/mcp`);
    expect(body).toContain(`${ORIGIN}/sitemap.xml`);
    expect(body).not.toMatch(/\/(?:admin|settings|signin|welcome)(?:[/)\s]|$)/);
  });

  it.each([
    ["robots.txt", getRobotsTxt],
    ["llms.txt", getLlmsTxt],
  ])("edge-caches %s while requiring browser revalidation", async (path, get) => {
    vi.stubEnv("APP_CANONICAL_ORIGIN", ORIGIN);

    const first = await getDiscoveryDocument(get, path);
    const etag = first.headers.get("ETag");

    expect(first.headers.get("Cache-Control")).toBe(
      "public, max-age=0, must-revalidate",
    );
    expect(first.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "public, max-age=3600, stale-while-revalidate=21600",
    );
    expect(first.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(etag).toMatch(/^"sha256-[A-Za-z0-9_-]+"$/);

    const conditional = await getDiscoveryDocument(get, path, {
      "If-None-Match": `"other", W/${etag}`,
    });

    expect(conditional.status).toBe(304);
    expect(await conditional.text()).toBe("");
    expect(conditional.headers.get("ETag")).toBe(etag);
  });

  it("adds the content-use policy to the sitemap", async () => {
    vi.stubEnv("APP_CANONICAL_ORIGIN", ORIGIN);

    const response = await getSitemapXml({
      request: new Request(`${ORIGIN}/sitemap.xml`),
    } as never);
    const body = await response.text();

    expect(response.headers.get("Content-Signal")).toBe(CONTENT_SIGNAL);
    expect(body).toContain(`<loc>${ORIGIN}/api/docs/tag/sections</loc>`);
    expect(body).toContain(`<loc>${ORIGIN}/catalog/courses/course-1</loc>`);
    expect(body).toContain(`<loc>${ORIGIN}/catalog/sections/section-1</loc>`);
    expect(body).toContain(`<loc>${ORIGIN}/catalog/teachers/1</loc>`);
  });
});
