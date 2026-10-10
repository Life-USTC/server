import type { Prisma } from "../../../../../src/generated/prisma-node/client";
import type { IsolatedWorker } from "../../../utils/isolated-worker";

export async function createNewsCountFixture(
  db: Prisma.TransactionClient,
  count: number,
) {
  const marker = `count-${crypto.randomUUID()}`;
  const sources = [];
  for (let index = 0; index < count; index++) {
    sources.push(
      await db.publicationSource.create({
        data: {
          id: `${marker}-source-${index}`,
          name: `Count grammar source ${index + 1}`,
          organizationLevel: "university",
          allowedHosts: ["example.test"],
        },
      }),
    );
  }
  return { marker, sources };
}

export async function setCountPublications(
  owner: IsolatedWorker["database"]["owner"],
  f: Awaited<ReturnType<typeof createNewsCountFixture>>,
  siblings: number | null,
) {
  await owner.$transaction(async (db) => {
    await db.publication.deleteMany({
      where: { sourceId: { in: f.sources.map((source) => source.id) } },
    });
    if (siblings === null) return;
    for (const [index, source] of f.sources.entries()) {
      for (
        let sibling = 0;
        sibling <= (index === 0 ? siblings : 0);
        sibling++
      ) {
        const publication = await db.publication.create({
          data: {
            sourceId: source.id,
            canonicalUrl: `https://example.test/${f.marker}/${index}/${sibling}`,
            title: `${f.marker} publication ${index}`,
            publicationType: "news",
            publishedAt: new Date("2026-01-01T00:00:00Z"),
          },
        });
        const revision = await db.publicationRevision.create({
          data: {
            publicationId: publication.id,
            revisionHash: `${index}-${sibling}`.padStart(64, "a"),
            title: publication.title,
            publicationType: "news",
            publishedAt: publication.publishedAt,
            observedAt: new Date("2026-01-01T00:00:00Z"),
          },
        });
        await db.publication.update({
          where: { id: publication.id },
          data: { currentRevisionId: revision.id },
        });
      }
    }
  });
}
