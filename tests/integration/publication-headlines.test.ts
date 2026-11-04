import pg from "pg";
import { expect, vi } from "vitest";
import {
  listPublicationHeadlines,
  listPublications,
} from "@/features/publications/server/publication-public-read-service";
import { nodeProtocolTest as test } from "../shared/node-protocol-fixture";

test("home headlines preserve public ordering without count or attachment queries", {
  tags: ["@Publication/Service"],
}, async ({ isolatedDatabase, protocolRuntime }) => {
  const db = isolatedDatabase.owner;
  await db.publicationSource.create({
    data: { id: "headlines", name: "Campus" },
  });
  const rows = [
    { id: "a", date: "2026-11-03", seen: "2026-11-04", title: "Current A" },
    { id: "b", date: "2026-11-03", seen: "2026-11-04", title: "Current B" },
    { id: "c", date: "2026-11-02", seen: "2026-11-05", title: null },
    { id: "d", date: null, seen: "2026-11-06", title: "Undated" },
    {
      id: "deleted",
      date: "2026-11-09",
      seen: "2026-11-09",
      title: "Deleted",
      deleted: true,
    },
    {
      id: "tombstone",
      date: "2026-11-09",
      seen: "2026-11-09",
      title: "Tombstone",
      tombstone: true,
    },
    {
      id: "other",
      date: "2026-11-09",
      seen: "2026-11-09",
      title: "Other",
      other: true,
    },
    {
      id: "revision-other",
      date: "2026-11-09",
      seen: "2026-11-09",
      title: "Other revision",
      revisionOther: true,
    },
    {
      id: "missing",
      date: "2026-11-09",
      seen: "2026-11-09",
      title: "No revision",
      missing: true,
    },
  ];
  for (const row of rows) {
    const publishedAt = row.date ? new Date(`${row.date}T00:00:00Z`) : null;
    await db.publication.create({
      data: {
        id: row.id,
        sourceId: "headlines",
        canonicalUrl: `https://publication.example/${row.id}`,
        title: "Denormalized title",
        publishedAt,
        lastSeenAt: new Date(`${row.seen}T00:00:00Z`),
        publicationType: row.other ? "other" : "news",
        deletedAt: row.deleted ? new Date("2026-11-04T00:00:00Z") : null,
      },
    });
    if (row.missing) continue;
    const revision = await db.publicationRevision.create({
      data: {
        publicationId: row.id,
        revisionHash: row.id.padEnd(64, "0"),
        observedAt: new Date("2026-11-04T00:00:00Z"),
        title: row.title,
        publishedAt,
        isTombstone: row.tombstone ?? false,
        publicationType: row.other || row.revisionOther ? "other" : "news",
      },
    });
    await db.publication.update({
      where: { id: row.id },
      data: { currentRevisionId: revision.id },
    });
  }
  const queries = vi.spyOn(pg.Client.prototype, "query");
  try {
    const full = await protocolRuntime.request(() =>
      listPublications({ pagination: { page: 1, pageSize: 3 } }),
    );
    const originalSql = queries.mock.calls.map(([query]) =>
      typeof query === "string" ? query : (query as { text: string }).text,
    );
    queries.mockClear();
    const headlines = await protocolRuntime.request(() =>
      listPublicationHeadlines(3),
    );
    const headlineSql = queries.mock.calls.map(([query]) =>
      typeof query === "string" ? query : (query as { text: string }).text,
    );
    expect(headlines).toEqual([
      {
        id: "a",
        source: { name: "Campus" },
        revision: {
          title: "Current A",
          publishedAt: new Date("2026-11-03T00:00:00Z"),
        },
      },
      {
        id: "b",
        source: { name: "Campus" },
        revision: {
          title: "Current B",
          publishedAt: new Date("2026-11-03T00:00:00Z"),
        },
      },
      {
        id: "c",
        source: { name: "Campus" },
        revision: { title: "", publishedAt: new Date("2026-11-02T00:00:00Z") },
      },
    ]);
    expect(headlines).toEqual(
      full.data.map((item) => ({
        id: item.id,
        source: { name: item.source.name },
        revision: {
          title: item.revision.title,
          publishedAt: item.revision.publishedAt,
        },
      })),
    );
    expect(originalSql.join("\n")).toMatch(/COUNT\(/i);
    expect(headlineSql.join("\n")).not.toMatch(/COUNT\(|PublicationObject/i);
    expect(
      (await protocolRuntime.request(() => listPublicationHeadlines(20))).map(
        ({ id }) => id,
      ),
    ).toEqual(["a", "b", "c", "d"]);
    await db.publicationSource.delete({ where: { id: "headlines" } });
    expect(
      await protocolRuntime.request(() => listPublicationHeadlines(6)),
    ).toEqual([]);
  } finally {
    queries.mockRestore();
  }
});
