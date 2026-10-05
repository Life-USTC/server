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

for (const method of ["REST", "GraphQL", "MCP"] as const) {
  it(`semester.list-order-pagination (${method})`, {
    tags: [`@Catalog/${method}`],
  }, async ({ isolatedDatabase, protocolRuntime, publicCatalogMcp }) => {
    await protocolRuntime.run(async () => {
      await publicCatalogMcp.initialize();
      const mcp = publicCatalogMcp.client;

      const observed: number[] = [];
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
        let rows: { id: number }[];
        let pagination: unknown;
        if (method === "REST") {
          const response = await protocolRuntime.request(() =>
            getSemestersRoute(
              new Request(
                `http://semester-${marker}.test/api/catalog/semesters?page=${page}&pageSize=${pageSize}`,
              ),
            ),
          );
          expect(response.status).toBe(200);
          const rest = await response.json();
          rows = rest.data;
          pagination = rest.pagination;
        } else if (method === "GraphQL") {
          const gql = (
            await protocolRuntime.request(() =>
              graph(
                "query($page: PageInput) { catalog { semesters(page: $page) { items { id } pageInfo { page pageSize total totalPages } } } }",
                { page: { page, pageSize } },
              ),
            )
          ).semesters;
          rows = gql.items;
          pagination = gql.pageInfo;
        } else {
          const native = await mcp.call<{
            success: boolean;
            data: { id: number }[];
            pagination: unknown;
          }>("catalog_semester_list", { page, limit: pageSize, mode: "full" });
          expect(native.success).toBe(true);
          rows = native.data;
          pagination = native.pagination;
        }
        const slice = expected.slice((page - 1) * pageSize, page * pageSize);
        const ids = rows.map((row) => row.id);
        observed.push(...ids);
        expect(ids).toEqual(slice);
        if (page > pages) expect(ids).toEqual([]);
        {
          expect(pagination).toEqual({
            page,
            pageSize,
            total: expected.length,
            totalPages: pages,
          });
        }
      }
      const byId = new Map(all.map((row) => [row.id, row]));
      {
        const ids = observed;
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
}
for (const method of ["REST", "GraphQL", "MCP"] as const) {
  it(`catalog-link.transport-list-search-parity (${method})`, {
    tags: [`@CatalogLink/${method}`],
  }, async ({ protocolRuntime, publicCatalogMcp }) => {
    await protocolRuntime.run(async () => {
      await publicCatalogMcp.initialize();
      const mcp = publicCatalogMcp.client;
      const expectedSlugs = USTC_CATALOG_LINKS.map((link) => link.slug);
      if (method !== "MCP") {
        for (const locale of ["zh-cn", "en-us"]) {
          let links: {
            slug: string;
            title: string;
            url: string;
            description: string;
          }[];
          if (method === "REST") {
            const response = await protocolRuntime.request(() =>
              getCatalogLinksRoute(
                new Request(
                  `http://localhost:3000/api/catalog/links?locale=${locale}`,
                ),
              ),
            );
            expect(response.status).toBe(200);
            links = (await response.json()).links;
          } else {
            links = (
              await protocolRuntime.request(() =>
                graph(
                  "{ catalog { links { slug title url description } } }",
                  {},
                  locale,
                ),
              )
            ).links;
          }
          expect(links.map((link) => link.slug)).toEqual(expectedSlugs);
          const expected = USTC_CATALOG_LINKS.map((link) => ({
            slug: link.slug,
            url: link.url,
            ...(locale === "en-us"
              ? link.localizations["en-us"]
              : { title: link.title, description: link.description }),
          }));
          if (method === "GraphQL") expect(links).toEqual(expected);
          expect(
            links.map(
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
      }
      if (method !== "REST") {
        for (const [query, expected] of [
          ["", expectedSlugs],
          ["  邮箱  ", ["mail"]],
          ["youxiang", ["mail"]],
          ["邮箱 USTC", ["mail"]],
          ["no-such-campus-link-93842", []],
        ] as const) {
          if (method === "GraphQL") {
            const gql = (
              await protocolRuntime.request(() =>
                graph(
                  "query($query: String) { catalog { links(query: $query) { slug } } }",
                  { query },
                ),
              )
            ).links;
            expect(gql.map((link: { slug: string }) => link.slug)).toEqual(
              expected,
            );
          } else {
            const native = await mcp.call<{
              success: boolean;
              links: { slug: string }[];
              total: number;
              returned: number;
            }>("catalog_link_list", { query, mode: "full" });
            expect(native.success).toBe(true);

            expect(native.links.map((link) => link.slug)).toEqual(expected);
            expect(native.total).toBe(expectedSlugs.length);
            expect(native.returned).toBe(expected.length);
          }
        }
      }
    });
  });
}
