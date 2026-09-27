import type { RequestEvent } from "@sveltejs/kit";
import { afterAll, expect, it } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { mcpPostRoute } from "@/lib/api/routes/mcp";
import {
  getYoungEventsRoute,
  getYoungOrganizersRoute,
} from "@/lib/api/routes/young-event-routes";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";
import { createFixturePrisma } from "../shared/prisma";
import {
  cleanupYoungBrowseFixture,
  createYoungBrowseFixture,
} from "../shared/young-browse-fixture";

const db = createFixturePrisma();
const graphql = createGraphqlRequestHandler(false);
const origin = "http://localhost:3000";
type Filter = Record<string, string | boolean>;
function runtime<T>(work: () => T) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error("Missing application runtime database URL");
  return runWithCloudflareRuntimeEnv(
    { HYPERDRIVE: { connectionString } },
    work,
  );
}
async function graph(document: string, variables: Record<string, unknown>) {
  const request = new Request(`${origin}/api/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: document, variables }),
  });
  const response = await runtime(() =>
    graphql({
      request,
      locals: { authUser: null, locale: "zh-cn", requestId: "catalog-parity" },
    } as unknown as RequestEvent),
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.errors).toBeUndefined();
  return body.data.catalog;
}
async function mcp(name: string, args: Record<string, unknown>) {
  const request = new Request(`${origin}/api/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: { ...args, mode: "full", locale: "zh-cn" } },
    }),
  });
  const response = await runtime(() => mcpPostRoute(request));
  expect(response.status).toBe(200);
  const text = await response.text();
  const data = response.headers
    .get("content-type")
    ?.includes("text/event-stream")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .at(-1)
        ?.slice(6)
    : text;
  if (!data) throw new Error("MCP HTTP response has no JSON-RPC data");
  const body = JSON.parse(data);
  expect(body.error).toBeUndefined();
  expect(body.result.isError).not.toBe(true);
  return JSON.parse(
    body.result.content.find((part: { type: string }) => part.type === "text")
      .text,
  );
}

async function comparePages(
  kind: "event" | "organizer",
  filter: Filter,
  expectedIds: string[],
  unknownDateCount = 0,
) {
  const pageSize = 2;
  for (
    let page = 1;
    page <= Math.ceil(expectedIds.length / pageSize) + 1;
    page++
  ) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    for (const [key, value] of Object.entries(filter))
      params.set(key, String(value));
    const response = await runtime(() =>
      (kind === "event" ? getYoungEventsRoute : getYoungOrganizersRoute)(
        new Request(`${origin}/api/catalog/young-${kind}s?${params}`),
      ),
    );
    expect(response.status).toBe(200);
    const rest = await response.json();
    const fields =
      kind === "event"
        ? "youngId name isActive category module activityLevel organizerId startAt endAt applyStartAt applyEndAt"
        : "id name normalizedName totalCount activeCount upcomingCount historyCount";
    const field = kind === "event" ? "youngEvents" : "youngOrganizers";
    const result = await graph(
      `query Parity($page: PageInput, ${kind === "event" ? "$filter: YoungEventFilter" : "$search: String"}) { catalog { ${field}(page: $page, ${kind === "event" ? "filter: $filter" : "search: $search"}) { items { ${fields} } pageInfo { page pageSize total totalPages } ${kind === "event" ? "unknownDateCount" : ""} } } }`,
      {
        page: { page, pageSize },
        ...(kind === "event" ? { filter } : { search: filter.search }),
      },
    );
    const tools = await mcp(`catalog_young_${kind}_list`, {
      ...filter,
      page,
      limit: pageSize,
    });
    const pick = (rows: Record<string, unknown>[]) =>
      rows.map((row) =>
        Object.fromEntries(fields.split(" ").map((key) => [key, row[key]])),
      );
    const expectedPagination = {
      page,
      pageSize,
      total: expectedIds.length,
      totalPages: Math.max(1, Math.ceil(expectedIds.length / pageSize)),
    };
    expect(rest.pagination).toEqual(expectedPagination);
    expect(result[field].pageInfo).toEqual(expectedPagination);
    expect(tools.pagination).toEqual(expectedPagination);
    expect(pick(result[field].items)).toEqual(pick(rest.data));
    expect(pick(tools.data)).toEqual(pick(rest.data));
    expect(
      rest.data.map(
        (row: Record<string, unknown>) =>
          row[kind === "event" ? "youngId" : "id"],
      ),
    ).toEqual(expectedIds.slice((page - 1) * pageSize, page * pageSize));
    if (kind === "event") {
      expect(rest.unknownDateCount).toBe(unknownDateCount);
      expect(result[field].unknownDateCount).toBe(unknownDateCount);
      expect(tools.unknownDateCount).toBe(unknownDateCount);
    }
  }
}
afterAll(() => db.$disconnect());
it("interface-hierarchy.young-public-read-parity", async () => {
  const fixture = await createYoungBrowseFixture(db);
  const { search, category, eventIds, organizerIds } = fixture;
  const ids = (...indices: number[]) => indices.map((index) => eventIds[index]);
  const ties = [0, 1, 2, 3, 4, 5];
  const ordered = [9, 10, ...ties, 8, 12, 7, 6, 11];
  try {
    resetPublicRuntimeCacheForTest();
    await comparePages(
      "event",
      { search: ` ${search.toUpperCase()} ` },
      ids(...ordered),
    );
    await comparePages(
      "event",
      { search, active: true },
      ids(...ordered.filter((index) => index !== 6 && index !== 11)),
    );
    await comparePages("event", { search, active: false }, ids(6, 11));
    await comparePages(
      "event",
      { search: "E", category, organizerId: organizerIds[0] },
      ids(...ordered.filter((index) => index !== 6)),
    );
    await comparePages("event", { search, category: "单" }, []);
    await comparePages("event", { search, activityLevel: "院" }, []);

    await comparePages(
      "event",
      { search, category: `${category}-other` },
      ids(6),
    );
    await comparePages("event", { search, module: "体" }, ids(6));
    await comparePages("event", { search, activityLevel: " 院级 " }, ids(6));
    await comparePages(
      "event",
      { search, organizerId: organizerIds[0] },
      ids(...ordered),
    );
    await comparePages("event", { search, organizerId: organizerIds[1] }, []);
    await comparePages("event", { search, organizerId: eventIds[0] }, []);
    await comparePages(
      "event",
      {
        search,
        active: true,
        category,
        module: "智",
        activityLevel: "校级",
        organizerId: organizerIds[0],
      },
      ids(10, ...ties, 8, 12),
    );
    await comparePages(
      "event",
      { search, category: `${category}-other`, module: "智" },
      [],
    );
    await comparePages("event", { search, dateUnknown: true }, ids(7));
    await comparePages(
      "event",
      { search, dateUnknown: false },
      ids(...ordered.filter((index) => index !== 7)),
    );
    await comparePages(
      "event",
      { search, dateUnknown: true, timeBasis: "registration" },
      ids(10),
    );
    await comparePages(
      "event",
      { search, dateUnknown: false, timeBasis: "registration" },
      ids(...ordered.filter((index) => index !== 10)),
    );
    await comparePages(
      "event",
      { search, dateFrom: "2035-09-15", dateTo: "2035-09-15" },
      ids(8, ...ties, 10),
      1,
    );
    await comparePages(
      "event",
      {
        search,
        dateFrom: "2035-09-15",
        dateTo: "2035-09-15",
        timeBasis: "registration",
      },
      ids(...ties, 7, 9),
      1,
    );
    await comparePages(
      "event",
      { search, dateFrom: "2035-09-16" },
      ids(6, 9),
      1,
    );
    await comparePages(
      "event",
      { search, dateTo: "2035-09-14" },
      ids(8, 11, 12),
      1,
    );
    await comparePages(
      "event",
      { search, dateFrom: "2035-10-01", dateTo: "2035-10-01" },
      [],
      1,
    );
    await comparePages("event", { search: `${search}-missing` }, []);
    // API alphabetical order deliberately differs from Web's active-first groups.
    // Six equal-name organizers were inserted in reverse ID order.
    await comparePages(
      "organizer",
      { search: ` ${fixture.marker.toUpperCase()} ` },
      [
        ...organizerIds.slice(12),
        ...organizerIds.slice(6, 12),
        ...organizerIds.slice(0, 6),
      ],
    );
    await comparePages("organizer", { search: `${fixture.marker} tie` }, [
      ...organizerIds.slice(6, 12),
      ...organizerIds.slice(0, 6),
    ]);
    await comparePages(
      "organizer",
      { search: `${fixture.marker}-missing` },
      [],
    );
  } finally {
    await cleanupYoungBrowseFixture(db, fixture);
    resetPublicRuntimeCacheForTest();
  }
});
