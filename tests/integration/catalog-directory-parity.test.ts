import type { RequestEvent } from "@sveltejs/kit";
import { expect } from "vitest";
import { USTC_CATALOG_LINKS } from "@/features/catalog-links/lib/catalog-links";
import { getSemestersRoute } from "@/lib/api/routes/academic-metadata-routes";
import { getCatalogLinksRoute } from "@/lib/api/routes/catalog-link-routes";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { publicCatalogProtocolTest as it } from "../shared/public-catalog-protocol-fixture";

async function graph(
  query: string,
  variables: Record<string, unknown>,
  locale = "zh-cn",
) {
  const response = await createGraphqlRequestHandler(false)({
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

it("semester.list-order-pagination", async ({
  isolatedDatabase,
  protocolRuntime,
  publicCatalogMcp,
}) => {
  await protocolRuntime.run(async () => {
    await publicCatalogMcp.initialize();
    const mcp = publicCatalogMcp.client;

    const observed = new Map<string, number[]>([
      ["rest", []],
      ["graphql", []],
      ["mcp", []],
    ]);
    const marker = crypto.randomUUID();
    const base = 1_750_000_000 + Math.floor(Math.random() * 10_000_000);
    const all = await isolatedDatabase.owner.$transaction(async (db) => {
      const rows = [];
      for (const index of [0, 1, 2, 3, 4, 5]) {
        rows.push(
          await db.semester.create({
            data: {
              jwId: base + index,
              code: `${marker}-${index}`,
              nameCn: `契约学期${index}`,
              startDate:
                index < 3
                  ? new Date(
                      index === 2
                        ? "2034-09-01T00:00:00Z"
                        : "2035-09-01T00:00:00Z",
                    )
                  : null,
            },
          }),
        );
      }
      return rows;
    });
    // Dated semesters first, then null dates; equal dates use descending JW ID.
    const expected = [
      all[1].id,
      all[0].id,
      all[2].id,
      all[5].id,
      all[4].id,
      all[3].id,
    ];
    const pageSize = 2;
    const pages = Math.ceil(expected.length / pageSize);
    for (let page = 1; page <= pages + 1; page++) {
      const response = await protocolRuntime.request(() =>
        getSemestersRoute(
          new Request(
            `http://semester-${marker}.test/api/catalog/semesters?page=${page}&pageSize=${pageSize}`,
          ),
        ),
      );
      expect(response.status).toBe(200);
      const rest = await response.json();
      const gql = (
        await protocolRuntime.request(() =>
          graph(
            "query($page: PageInput) { catalog { semesters(page: $page) { items { id } pageInfo { page pageSize total totalPages } } } }",
            { page: { page, pageSize } },
          ),
        )
      ).semesters;
      const native = await mcp.call<{
        success: boolean;
        data: { id: number }[];
        pagination: unknown;
      }>("catalog_semester_list", { page, limit: pageSize, mode: "full" });
      expect(native.success).toBe(true);
      const slice = expected.slice((page - 1) * pageSize, page * pageSize);
      for (const [surface, rows] of [
        ["rest", rest.data],
        ["graphql", gql.items],
        ["mcp", native.data],
      ] as const) {
        const ids = rows.map((row: { id: number }) => row.id);
        observed.get(surface)?.push(...ids);
        expect(ids).toEqual(slice);
        if (page > pages) expect(ids).toEqual([]);
      }
      for (const pagination of [
        rest.pagination,
        gql.pageInfo,
        native.pagination,
      ]) {
        expect(pagination).toEqual({
          page,
          pageSize,
          total: expected.length,
          totalPages: pages,
        });
      }
    }
    const byId = new Map(all.map((row) => [row.id, row]));
    for (const ids of observed.values()) {
      const rows = ids.map((id) => {
        const row = byId.get(id);
        if (!row) throw new Error("Unknown observed semester");
        return row;
      });
      const dates = rows.flatMap((row) =>
        row.startDate ? [row.startDate.getTime()] : [],
      );
      const datesDescending = dates.every(
        (date, index) => index === 0 || dates[index - 1] >= date,
      );
      const firstNull = rows.findIndex((row) => row.startDate === null);
      const nullsLast =
        firstNull >= 0 &&
        rows.slice(firstNull).every((row) => row.startDate === null);
      const tiesDescending = rows.every(
        (row, index) =>
          index === 0 ||
          row.startDate?.getTime() !== rows[index - 1].startDate?.getTime() ||
          rows[index - 1].jwId > row.jwId,
      );
      expect(datesDescending).toBe(true);
      expect(nullsLast).toBe(true);
      expect(tiesDescending).toBe(true);
    }
  });
});

it("catalog-link.transport-list-search-parity", async ({
  protocolRuntime,
  publicCatalogMcp,
}) => {
  await protocolRuntime.run(async () => {
    await publicCatalogMcp.initialize();
    const mcp = publicCatalogMcp.client;
    const expectedSlugs = USTC_CATALOG_LINKS.map((link) => link.slug);
    for (const locale of ["zh-cn", "en-us"]) {
      const response = await protocolRuntime.request(() =>
        getCatalogLinksRoute(
          new Request(
            `http://localhost:3000/api/catalog/links?locale=${locale}`,
          ),
        ),
      );
      expect(response.status).toBe(200);
      const rest = (await response.json()).links;
      const gql = (
        await protocolRuntime.request(() =>
          graph(
            "{ catalog { links { slug title url description } } }",
            {},
            locale,
          ),
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
        await protocolRuntime.request(() =>
          graph(
            "query($query: String) { catalog { links(query: $query) { slug } } }",
            { query },
          ),
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
});
