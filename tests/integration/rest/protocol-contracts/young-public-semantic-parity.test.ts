import { expect } from "@playwright/test";
import { test } from "../../../e2e/utils/owned-worker";
import type { TestPrismaClient } from "../../../shared/prisma";
import { createYoungBrowseFixture } from "../../../shared/young-browse-fixture";
import { createPublicParityClient } from "./_public-parity";

type Filter = Record<string, string | boolean>;
async function createYoungReaders(
  origin: string,
  transport: "REST" | "GraphQL" | "MCP",
  db: TestPrismaClient,
) {
  // Snapshot only test-prepared rows; expected ordering and selected IDs stay explicit below.
  const events = await db.youngEvent.findMany();
  const organizers = await db.youngOrganizer.findMany();
  const expectedRows = new Map<string, Record<string, unknown>>();
  for (const event of events) {
    const expected = JSON.parse(JSON.stringify(event));
    for (const key of [
      "startAt",
      "endAt",
      "applyStartAt",
      "applyEndAt",
    ] as const) {
      const date = event[key];
      expected[key] =
        date == null
          ? null
          : `${new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19)}+08:00`;
    }
    expectedRows.set(event.youngId, expected);
  }
  for (const [index, organizer] of organizers
    .sort((a, b) => a.id.localeCompare(b.id))
    .entries()) {
    expectedRows.set(organizer.id, {
      ...organizer,
      totalCount: index === 0 ? 14 : 1,
      activeCount: index === 0 ? 12 : index < 6 ? 1 : 0,
      upcomingCount: index === 0 ? 12 : 0,
      historyCount: 0,
    });
  }
  const { rest: read, graph, mcp } = createPublicParityClient(origin);
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

      const fields =
        kind === "event"
          ? "youngId name isActive category module activityLevel organizerId startAt endAt applyStartAt applyEndAt"
          : "id name normalizedName totalCount activeCount upcomingCount historyCount";
      const field = kind === "event" ? "youngEvents" : "youngOrganizers";
      let rows: Record<string, unknown>[];
      let pagination: Record<string, number>;
      let actualUnknownDateCount: number | undefined;
      if (transport === "REST") {
        const result = await read(`/api/catalog/young-${kind}s?${params}`);
        rows = result.data;
        pagination = result.pagination;
        actualUnknownDateCount = result.meta?.unknownDateCount;
      } else if (transport === "GraphQL") {
        const result = await graph(
          `query Parity($page: PageInput, ${kind === "event" ? "$filter: YoungEventFilter" : "$search: String"}) { catalog { ${field}(page: $page, ${kind === "event" ? "filter: $filter" : "search: $search"}) { items { ${fields} } pageInfo { page pageSize total totalPages } ${kind === "event" ? "unknownDateCount" : ""} } } }`,
          {
            page: { page, pageSize },
            ...(kind === "event" ? { filter } : { search: filter.search }),
          },
        );
        rows = result[field].items;
        pagination = result[field].pageInfo;
        actualUnknownDateCount = result[field].unknownDateCount;
      } else {
        const result = await mcp(`catalog_young_${kind}_list`, {
          ...filter,
          page,
          limit: pageSize,
        });
        rows = result.data;
        pagination = result.pagination;
        actualUnknownDateCount = result.unknownDateCount;
      }
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
      const pageIds = expectedIds.slice((page - 1) * pageSize, page * pageSize);
      expect(pagination).toEqual(expectedPagination);
      expect(
        rows.map((row) => row[kind === "event" ? "youngId" : "id"]),
      ).toEqual(pageIds);
      expect(pick(rows)).toEqual(
        pick(
          pageIds.map((id) => {
            const row = expectedRows.get(id);
            if (!row) throw new Error(`Missing prepared Young row ${id}`);
            return row;
          }),
        ),
      );
      if (kind === "event")
        expect(actualUnknownDateCount).toBe(unknownDateCount);
    }
  }
  return { comparePages };
}
for (const transport of ["REST", "GraphQL", "MCP"] as const)
  test(
    `Young event search and taxonomy consumers through ${transport}`,
    { tag: `@Young/${transport}` },
    async ({ isolatedWorker, run }) =>
      run(async () => {
        const db = isolatedWorker.database.owner;
        const fixture = await createYoungBrowseFixture(db);
        const { comparePages } = await createYoungReaders(
          isolatedWorker.origin,
          transport,
          db,
        );
        const { search, category, eventIds, organizerIds } = fixture;
        const ids = (...indices: number[]) =>
          indices.map((index) => eventIds[index]);
        const ties = [0, 1, 2, 3, 4, 5];
        const ordered = [9, 10, ...ties, 8, 12, 7, 6, 11];
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
        await comparePages(
          "event",
          { search, activityLevel: " 院级 " },
          ids(6),
        );
        await comparePages(
          "event",
          { search, organizerId: organizerIds[0] },
          ids(...ordered),
        );
        await comparePages(
          "event",
          { search, organizerId: organizerIds[1] },
          [],
        );
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
        await comparePages("event", { search: `${search}-missing` }, []);
      }),
  );

for (const transport of ["REST", "GraphQL", "MCP"] as const)
  test(
    `Young event date consumers through ${transport}`,
    { tag: `@Young/${transport}` },
    async ({ isolatedWorker, run }) =>
      run(async () => {
        const db = isolatedWorker.database.owner;
        const fixture = await createYoungBrowseFixture(db);
        const { comparePages } = await createYoungReaders(
          isolatedWorker.origin,
          transport,
          db,
        );
        const { search, eventIds } = fixture;
        const ids = (...indices: number[]) =>
          indices.map((index) => eventIds[index]);
        const ties = [0, 1, 2, 3, 4, 5];
        const ordered = [9, 10, ...ties, 8, 12, 7, 6, 11];
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
      }),
  );

for (const transport of ["REST", "GraphQL", "MCP"] as const)
  test(
    `Young organizer search and ordering consumers through ${transport}`,
    { tag: `@Young/${transport}` },
    async ({ isolatedWorker, run }) =>
      run(async () => {
        const db = isolatedWorker.database.owner;
        const fixture = await createYoungBrowseFixture(db);
        const { comparePages } = await createYoungReaders(
          isolatedWorker.origin,
          transport,
          db,
        );
        const { organizerIds } = fixture;
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
      }),
  );
