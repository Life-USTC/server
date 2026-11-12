import { type APIResponse, expect } from "@playwright/test";
import { unflatten } from "devalue";
import type { Element, Root } from "hast";
import rehypeParse from "rehype-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { isRecord } from "../../../../src/lib/is-record";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
const pages = [
  "/terms",
  "/privacy",
  "/guides/markdown-support",
  "/usage/mobile",
  "/usage/bot",
  "/usage/cli",
  "/usage/mcp",
];
async function snapshot(worker: IsolatedWorker) {
  const db = worker.database.owner;
  const tables = await db.$queryRawUnsafe<{ tablename: string }[]>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  const rows: Record<string, unknown[]> = {};
  for (const { tablename } of tables)
    rows[tablename] = await db.$queryRawUnsafe(
      'SELECT row_to_json(t)::text AS row FROM "' +
        tablename.replaceAll('"', '""') +
        '" t ORDER BY row_to_json(t)::text',
    );
  return rows;
}
function privateHeaders(response: APIResponse) {
  expect(response.headers()).toMatchObject({
    "cache-control": "private, no-store",
    "cloudflare-cdn-cache-control": "no-store",
    vary: "Cookie",
    "x-robots-tag": "noindex, nofollow, noarchive",
  });
  expect(response.headers()["x-life-public-navigation"]).toBeUndefined();
}
function pageData(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.nodes))
    throw new Error("Expected the actual information page data");
  const nodes: Record<string, unknown>[] = [];
  for (const node of value.nodes) {
    if (!isRecord(node) || !Array.isArray(node.data)) continue;
    const decoded: unknown = unflatten(node.data);
    if (!isRecord(decoded)) throw new Error("Expected decoded page data node");
    nodes.push(decoded);
  }
  const loaded: Record<string, unknown> = Object.assign({}, ...nodes);
  return loaded;
}
function text(node: Root | Element) {
  const parts: string[] = [];
  visit(node, "text", (value) => {
    parts.push(value.value);
  });
  return parts.join("").replace(/\s+/g, " ").trim();
}
function actualHtml(html: string) {
  const tree: Root = unified().use(rehypeParse, { fragment: true }).parse(html);
  const headings: string[] = [],
    articles: string[] = [];
  visit(tree, "element", (node) => {
    if (node.tagName === "h1") headings.push(text(node));
    if (node.tagName === "article") articles.push(text(node));
  });
  return { headings, articles, text: text(tree) };
}

for (const locale of ["en-us", "zh-cn"] as const) {
  test(`demo information retains real reading content and seals effects ${locale}`, {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const english = locale === "en-us";
      const titles = english
        ? [
            "Terms of Service",
            "Privacy Policy",
            "Comment formatting",
            "Life@USTC",
            "Meet Presto",
            "Life@USTC in your terminal",
            "Connect with MCP",
          ]
        : [
            "服务条款",
            "隐私政策",
            "评论格式指南",
            "Life@USTC",
            "认识 Presto",
            "终端里的 Life@USTC",
            "通过 MCP 连接",
          ];
      const actor = await isolatedWorker.createActor();
      const ordinaryCookie = `${actor.cookie.name}=${actor.cookie.value}; NEXT_LOCALE=${locale}`;
      const ordinaryViewer = await request.get("/_internal/shell-bootstrap", {
        headers: { cookie: ordinaryCookie },
      });
      expect(ordinaryViewer.status()).toBe(200);
      expect(await ordinaryViewer.json()).toMatchObject({
        viewer: { id: actor.id },
      });
      const originals: Record<string, Record<string, unknown>> = {};
      for (const path of ["/terms", "/privacy"]) {
        const response = await request.get(`${path}/__data.json`, {
          headers: { cookie: ordinaryCookie },
        });
        expect(response.status()).toBe(200);
        const loaded = pageData(await response.json());
        // Existing public navigation data never embeds the signed-in viewer.
        expect(loaded.user).toBeNull();
        expect(loaded.pageDemo).toBeNull();
        expect(loaded.pageLocale).toBe(locale);
        if (!isRecord(loaded.content))
          throw new Error("Expected the real ordinary legal content");
        originals[path] = loaded.content;
      }
      const before = await snapshot(isolatedWorker);
      const now = Math.floor(Date.now() / 1000);
      const signed = await createSignedDemoCookie({ issuedAt: now });
      const expired = await createSignedDemoCookie({ issuedAt: now - 901 });
      const cookie = `${signed.name}=${signed.value}; NEXT_LOCALE=${locale}`;
      const secret = { "x-test-storage-secret": "local-test-storage-observer" };
      const id = crypto.randomUUID(),
        probe = `/__test/community-effects?id=${id}`;
      const registration = await request.post(`${probe}&io=1`, {
        headers: secret,
      });
      await registration.body();
      expect(registration.status()).toBe(201);
      const admitted: { method: string; path: string }[] = [];
      const read = async (
        path: string,
        status = 200,
        method = "GET",
        extra: Record<string, string> = {},
      ) => {
        admitted.push({
          method,
          path: new URL(path, isolatedWorker.origin).pathname,
        });
        const response = await request.fetch(path, {
          method,
          maxRedirects: 0,
          headers: {
            ...secret,
            "x-test-community-probe": id,
            cookie,
            origin: isolatedWorker.origin,
            ...extra,
          },
        });
        await response.body();
        expect(response.status(), `${method} ${path}`).toBe(status);
        privateHeaders(response);
        return response;
      };
      try {
        for (const [index, path] of pages.entries()) {
          const html = await (await read(path)).text();
          const rendered = actualHtml(html);
          expect(rendered.headings).toContain(titles[index]);
          expect(html).toContain('data-testid="demo-notice"');
          expect(html).not.toContain(actor.id);
          expect(html).not.toMatch(
            /href="https?:\/\/(?:apps\.apple\.com|qm\.qq\.com|github\.com\/Life-USTC\/CLI|tools\.google\.com|developers\.openai\.com|support\.claude\.com)/,
          );
          const loaded = pageData(
            await (await read(`${path}/__data.json`)).json(),
          );
          expect(loaded).toMatchObject({
            user: null,
            locale,
            pageLocale: locale,
            pageDemo: {
              fixtureVersion: "workspace-v1",
              expiresAt: (now + 900) * 1000,
            },
          });
          if (path === "/terms" || path === "/privacy") {
            const content = loaded.content;
            if (!isRecord(content))
              throw new Error("Expected unchanged legal document fields");
            for (const key of ["title", "intro", "sections", "mdx"])
              expect(content[key]).toEqual(originals[path][key]);
            expect(rendered.articles).toContain(
              actualHtml(String(originals[path].renderedHtml)).text,
            );
            if (path === "/privacy") {
              expect(String(content.renderedHtml)).toContain(
                'aria-disabled="true"',
              );
              expect(String(content.renderedHtml)).not.toContain(
                'href="https://tools.google.com',
              );
            }
          }
          for (const target of [path, `${path}/__data.json`]) {
            expect(await (await read(target, 200, "HEAD")).body()).toHaveLength(
              0,
            );
            for (const identity of [
              `${signed.name}=invalid`,
              `${expired.name}=${expired.value}`,
            ])
              await read(target, 401, "GET", {
                cookie: identity,
                accept: "application/json",
              });
            await read(target, 403, "GET", {
              cookie: `${cookie}; ${actor.cookie.name}=${actor.cookie.value}`,
            });
            for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
              const denied = await read(target, 403, method);
              expect(denied.headers().location).toBeUndefined();
            }
          }
        }
        for (const client of ["chatgpt", "claude", "other", "unknown"]) {
          const loaded = pageData(
            await (
              await read(`/usage/mcp/__data.json?client=${client}`)
            ).json(),
          );
          expect(loaded.client).toBe(client === "unknown" ? "chatgpt" : client);
        }
        for (const method of ["GET", "HEAD"]) {
          const redirected = await read(
            "/community/comments/guide",
            307,
            method,
          );
          expect(redirected.headers().location).toBe(
            "/guides/markdown-support",
          );
        }
        expect(
          await (await read("/community/comments/guide/__data.json")).json(),
        ).toEqual({
          type: "redirect",
          status: 307,
          location: "/guides/markdown-support",
        });
        for (const method of ["POST", "PUT", "PATCH", "DELETE"])
          await read("/community/comments/guide", 403, method);
        for (const alias of [
          "/TERMS",
          "/terms/unknown",
          "/usage/unknown",
          "/guides/unknown",
          "/account/settings",
        ])
          await read(alias, 403);
        const expiredHtml = await read("/terms", 303, "GET", {
          cookie: `${expired.name}=${expired.value}`,
          accept: "text/html",
        });
        expect(expiredHtml.headers().location).toBe("/account/sign-in");
        const effects: unknown = await (
          await request.get(probe, { headers: secret })
        ).json();
        expect(effects).toMatchObject({
          purges: [],
          messages: [],
          backgroundErrors: [],
          io: { bindings: [], outbound: [] },
        });
        if (
          !isRecord(effects) ||
          !Array.isArray(effects.requests) ||
          !effects.requests.every(isRecord)
        )
          throw new Error("Expected the full information request ledger");
        expect(
          effects.requests.every((entry) => entry.outcome === "fulfilled"),
        ).toBe(true);
        const counts = new Map<string, number>();
        for (const entry of admitted) {
          const key = `${entry.method} ${entry.path}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        for (const [key, count] of counts)
          expect(
            effects.requests.filter(
              (entry) =>
                isRecord(entry.value) &&
                entry.outcome === "fulfilled" &&
                `${entry.value.method} ${entry.value.path}` === key,
            ).length,
            key,
          ).toBeGreaterThanOrEqual(count);
        expect(await snapshot(isolatedWorker)).toEqual(before);
      } finally {
        const removed = await request.delete(probe, { headers: secret });
        await removed.body();
        expect(removed.status()).toBe(204);
      }
    });
  });
}
