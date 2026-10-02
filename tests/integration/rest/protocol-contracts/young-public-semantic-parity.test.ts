import { expect } from "@playwright/test";
import { test } from "../../../e2e/utils/owned-worker";
import { createYoungBrowseFixture } from "../../../shared/young-browse-fixture";
import { createPublicParityClient } from "./_public-parity";

type Filter = Record<string, string | boolean>;
function createYoungReaders(origin: string) {
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
      const rest = await read(`/api/catalog/young-${kind}s?${params}`);
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
        // REST metadata is nested; GraphQL and native MCP expose the same fact directly.
        expect(rest.meta.unknownDateCount).toBe(unknownDateCount);
        expect(result[field].unknownDateCount).toBe(unknownDateCount);
        expect(tools.unknownDateCount).toBe(unknownDateCount);
      }
    }
  }
  return { comparePages };
}

const ties = [0, 1, 2, 3, 4, 5];
const ordered = [9, 10, ...ties, 8, 12, 7, 6, 11];

/** Each case owns a complete fixture; tied sort keys depend on all of its rows. */
async function arrangeYoungBrowse(
  db: Parameters<typeof createYoungBrowseFixture>[0],
  origin: string,
) {
  const fixture = await createYoungBrowseFixture(db);
  const { comparePages } = createYoungReaders(origin);
  const ids = (...indices: number[]) =>
    indices.map((index) => fixture.eventIds[index]);
  return { ...fixture, comparePages, ids };
}

test.describe("interface-hierarchy.young-public-read-parity", () => {
  test("event search, source-active state and default order", async ({
    isolatedWorker,
    run,
  }) =>
    run(async () => {
      const { comparePages, ids, search } = await arrangeYoungBrowse(
        isolatedWorker.database.owner,
        isolatedWorker.origin,
      );
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
      await comparePages("event", { search: `${search}-missing` }, []);
    }));

  test("event taxonomy and organizer filters", async ({
    isolatedWorker,
    run,
  }) =>
    run(async () => {
      const { comparePages, ids, search, category, organizerIds, eventIds } =
        await arrangeYoungBrowse(
          isolatedWorker.database.owner,
          isolatedWorker.origin,
        );
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
    }));

  test("event activity and registration date semantics", async ({
    isolatedWorker,
    run,
  }) =>
    run(async () => {
      const { comparePages, ids, search } = await arrangeYoungBrowse(
        isolatedWorker.database.owner,
        isolatedWorker.origin,
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
    }));

  test("organizer search and name order", async ({ isolatedWorker, run }) =>
    run(async () => {
      const fixture = await arrangeYoungBrowse(
        isolatedWorker.database.owner,
        isolatedWorker.origin,
      );
      const { comparePages, organizerIds } = fixture;
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
    }));
});
