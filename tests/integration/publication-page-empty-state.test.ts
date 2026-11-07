import pg from "pg";
import { expect, vi } from "vitest";
import { loadPublicationListPage } from "@/features/publications/server/publication-page-load";
import {
  hasPublicPublications,
  listPublications,
} from "@/features/publications/server/publication-public-read-service";
import { nodeProtocolTest as test } from "../shared/node-protocol-fixture";

function queryText(query: unknown) {
  if (typeof query === "string") return query;
  if (
    query &&
    typeof query === "object" &&
    "text" in query &&
    typeof query.text === "string"
  )
    return query.text;
  return "";
}

test("news empty state existence uses only current public publications and a bounded read", {
  tags: ["@Publication/Service"],
}, async ({ isolatedDatabase, protocolRuntime }) => {
  const db = isolatedDatabase.owner;
  expect(await protocolRuntime.request(() => hasPublicPublications())).toBe(
    false,
  );
  await db.publicationSource.create({
    data: { id: "visibility", name: "Isolated visibility source" },
  });
  for (const kind of [
    "other",
    "revision-other",
    "deleted",
    "tombstone",
    "missing",
  ]) {
    const row = await db.publication.create({
      data: {
        id: `hidden-${kind}`,
        sourceId: "visibility",
        canonicalUrl: `https://example.test/${kind}`,
        title: "Private matching marker",
        publicationType: kind === "other" ? "other" : "news",
        deletedAt: kind === "deleted" ? new Date("2026-01-01") : null,
      },
    });
    if (kind === "missing") continue;
    const revision = await db.publicationRevision.create({
      data: {
        publicationId: row.id,
        revisionHash: kind.padEnd(64, "0"),
        observedAt: new Date("2026-01-01"),
        title: "Private matching marker",
        publicationType: kind === "revision-other" ? "other" : "news",
        isTombstone: kind === "tombstone",
      },
    });
    await db.publication.update({
      where: { id: row.id },
      data: { currentRevisionId: revision.id },
    });
  }
  const before = await db.publication.findMany({ orderBy: { id: "asc" } });
  const queries = vi.spyOn(pg.Client.prototype, "query");
  try {
    expect(await protocolRuntime.request(() => hasPublicPublications())).toBe(
      false,
    );
    const reads = queries.mock.calls
      .map(([query]) => queryText(query))
      .filter(
        (sql) => sql.startsWith("SELECT") && sql.includes('"Publication"'),
      );
    expect(reads).toHaveLength(1);
    expect(reads[0]).toMatch(/\bLIMIT\b/);
    expect(reads[0]).not.toMatch(/\bCOUNT\s*\(/i);
  } finally {
    queries.mockRestore();
  }
  const hidden = await protocolRuntime.request(() =>
    loadPublicationListPage(
      new URL("https://example.test/news?query=Private"),
      "en-us",
    ),
  );
  expect(hidden.publications.data).toEqual([]);
  expect(hidden.hasPublications).toBe(false);
  expect(await db.publication.findMany({ orderBy: { id: "asc" } })).toEqual(
    before,
  );
  const pub = await db.publication.create({
    data: {
      id: "visible-notice",
      sourceId: "visibility",
      canonicalUrl: "https://example.test/public",
      title: "Public notice",
      publicationType: "notice",
    },
  });
  const revision = await db.publicationRevision.create({
    data: {
      publicationId: pub.id,
      revisionHash: "p".repeat(64),
      observedAt: new Date("2026-01-01"),
      title: "Public notice",
      publicationType: "notice",
    },
  });
  await db.publication.update({
    where: { id: pub.id },
    data: { currentRevisionId: revision.id },
  });
  const publicBefore = await db.publication.findMany({
    orderBy: { id: "asc" },
  });
  const noMatch = await protocolRuntime.request(() =>
    loadPublicationListPage(
      new URL("https://example.test/news?source=not-registered&query=Private"),
      "zh-cn",
    ),
  );
  expect(noMatch.publications.data).toEqual([]);
  expect(noMatch.hasPublications).toBe(true);
  expect(
    (await protocolRuntime.request(() => listPublications())).data.map(
      (row) => row.id,
    ),
  ).toEqual([pub.id]);
  expect(await db.publication.findMany({ orderBy: { id: "asc" } })).toEqual(
    publicBefore,
  );
});
