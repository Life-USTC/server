import type { RequestEvent } from "@sveltejs/kit";
import { afterAll, beforeAll, expect, it } from "vitest";
import { USTC_CATALOG_LINKS } from "@/features/catalog-links/lib/catalog-links";
import { getSemestersRoute } from "@/lib/api/routes/academic-metadata-routes";
import { getCatalogLinksRoute } from "@/lib/api/routes/catalog-link-routes";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { createFixturePrisma } from "../shared/prisma";
import {
  createAnonymousMcpHarness,
  type McpHarness,
} from "./mcp/_harness/client";

const db = createFixturePrisma();
const handler = createGraphqlRequestHandler(false);
let mcp: McpHarness;
beforeAll(async () => {
  mcp = await createAnonymousMcpHarness();
});
afterAll(async () => {
  await mcp.close();
  await db.$disconnect();
});
async function graph(
  query: string,
  variables: Record<string, unknown>,
  locale = "zh-cn",
) {
  const response = await handler({
    request: new Request("http://localhost:3000/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
    }),
    locals: { authUser: null, locale, requestId: "directory-parity" },
  } as unknown as RequestEvent);
  const body = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(200);
  expect(body.errors).toBeUndefined();
  return body.data.catalog;
}

it("semester.list-order-pagination", async () => {
  const marker = crypto.randomUUID();
  const base = 1_750_000_000 + Math.floor(Math.random() * 10_000_000);
  const created: number[] = [];
  try {
    for (const index of [0, 1, 2, 3, 4, 5]) {
      const semester = await db.semester.create({
        data: {
          jwId: base + index,
          code: `${marker}-${index}`,
          nameCn: `契约学期${index}`,
          startDate: index < 3 ? new Date("2035-09-01T00:00:00Z") : null,
        },
      });
      created.push(semester.id);
    }
    const all = await db.semester.findMany({
      select: { id: true, jwId: true, startDate: true },
    });
    all.sort((left, right) => {
      if (left.startDate === null && right.startDate !== null) return 1;
      if (left.startDate !== null && right.startDate === null) return -1;
      return (
        (right.startDate?.getTime() ?? 0) - (left.startDate?.getTime() ?? 0) ||
        right.jwId - left.jwId
      );
    });
    const expected = all.map((row) => row.id);
    const pageSize = 2;
    const pages = Math.ceil(expected.length / pageSize);
    for (let page = 1; page <= pages + 1; page++) {
      const response = await getSemestersRoute(
        new Request(
          `http://semester-${marker}.test/api/catalog/semesters?page=${page}&pageSize=${pageSize}`,
        ),
      );
      expect(response.status).toBe(200);
      const rest = await response.json();
      const gql = (
        await graph(
          "query($page: PageInput) { catalog { semesters(page: $page) { items { id } pageInfo { page pageSize total totalPages } } } }",
          { page: { page, pageSize } },
        )
      ).semesters;
      const native = await mcp.call<{
        success: boolean;
        data: { id: number }[];
        pagination: unknown;
      }>("catalog_semester_list", { page, limit: pageSize, mode: "full" });
      expect(native.success).toBe(true);
      const slice = expected.slice((page - 1) * pageSize, page * pageSize);
      for (const rows of [rest.data, gql.items, native.data])
        expect(rows.map((row: { id: number }) => row.id)).toEqual(slice);
      for (const pagination of [
        rest.pagination,
        gql.pageInfo,
        native.pagination,
      ])
        expect(pagination).toEqual({
          page,
          pageSize,
          total: expected.length,
          totalPages: pages,
        });
    }
  } finally {
    await db.semester.deleteMany({ where: { id: { in: created } } });
  }
});

it("catalog-link.transport-list-search-parity", async () => {
  const expectedSlugs = USTC_CATALOG_LINKS.map((link) => link.slug);
  for (const locale of ["zh-cn", "en-us"]) {
    const response = await getCatalogLinksRoute(
      new Request(`http://localhost:3000/api/catalog/links?locale=${locale}`),
    );
    expect(response.status).toBe(200);
    const rest = (await response.json()).links;
    const gql = (
      await graph(
        "{ catalog { links { slug title url description } } }",
        {},
        locale,
      )
    ).links;
    expect(rest.map((link: { slug: string }) => link.slug)).toEqual(
      expectedSlugs,
    );
    expect(gql.map((link: { slug: string }) => link.slug)).toEqual(
      expectedSlugs,
    );
    const expected = USTC_CATALOG_LINKS.map((link) => ({
      slug: link.slug,
      url: link.url,
      ...(locale === "en-us"
        ? link.localizations["en-us"]
        : { title: link.title, description: link.description }),
    }));
    expect(gql).toEqual(expected);
    expect(
      rest.map(
        ({
          slug,
          title,
          url,
          description,
        }: {
          slug: string;
          title: string;
          url: string;
          description: string;
        }) => ({ slug, title, url, description }),
      ),
    ).toEqual(expected);
  }
  for (const [query, expected] of [
    ["", expectedSlugs],
    ["  邮箱  ", ["mail"]],
    ["youxiang", ["mail"]],
    ["邮箱 USTC", ["mail"]],
    ["no-such-campus-link-93842", []],
  ] as const) {
    const gql = (
      await graph(
        "query($query: String) { catalog { links(query: $query) { slug } } }",
        { query },
      )
    ).links;
    const native = await mcp.call<{
      success: boolean;
      links: { slug: string }[];
      total: number;
      returned: number;
    }>("catalog_link_list", { query, mode: "full" });
    expect(native.success).toBe(true);
    expect(gql.map((link: { slug: string }) => link.slug)).toEqual(expected);
    expect(native.links.map((link) => link.slug)).toEqual(expected);
    expect(native.total).toBe(expectedSlugs.length);
    expect(native.returned).toBe(expected.length);
  }
});
