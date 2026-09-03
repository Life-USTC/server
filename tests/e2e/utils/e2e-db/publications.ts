import { withE2ePrisma } from "./prisma";

export type PublicationFixture = {
  canonicalUrl: string;
  id: string;
  sourceId: string;
  title: string;
  total: number;
};

export async function createPublicationFixture(prefix: string) {
  const sourceId = `e2e-publication-${prefix}`;
  const canonicalUrl = `https://news.example.test/${prefix}`;
  const title = `E2E publication ${prefix}`;
  const revisionHash = "e".repeat(64);
  const total = 21;
  const publishedAt = new Date("2026-09-01T00:00:00+08:00");

  return withE2ePrisma(async (prisma) => {
    await prisma.publicationSource.create({
      data: {
        id: sourceId,
        name: `E2E publication source ${prefix}`,
        organizationLevel: "e2e",
        allowedHosts: ["news.example.test"],
      },
    });

    let firstPublicationId = "";
    for (let index = 0; index < total; index += 1) {
      const itemTitle = index === 0 ? title : `${title} ${index + 1}`;
      const itemUrl =
        index === 0 ? canonicalUrl : `${canonicalUrl}/${index + 1}`;
      const itemPublishedAt = new Date(publishedAt.getTime() - index * 60_000);
      const publication = await prisma.publication.create({
        data: {
          sourceId,
          canonicalUrl: itemUrl,
          title: itemTitle,
          summary:
            "A deterministic publication used by the news page E2E test.",
          bodyText: "This is the body text rendered by the public detail page.",
          sourcePageUrl: itemUrl,
          publicationType: "news",
          publishedAt: itemPublishedAt,
        },
      });
      const revision = await prisma.publicationRevision.create({
        data: {
          publicationId: publication.id,
          revisionHash,
          observedAt: itemPublishedAt,
          title: itemTitle,
          summary:
            "A deterministic publication used by the news page E2E test.",
          bodyText: "This is the body text rendered by the public detail page.",
          sourcePageUrl: itemUrl,
          publishedAt: itemPublishedAt,
          publicationType: "news",
        },
      });
      await prisma.publication.update({
        where: { id: publication.id },
        data: { currentRevisionId: revision.id },
      });
      if (index === 0) firstPublicationId = publication.id;
    }

    return {
      canonicalUrl,
      id: firstPublicationId,
      sourceId,
      title,
      total,
    } satisfies PublicationFixture;
  });
}

export async function deletePublicationFixture(fixture: PublicationFixture) {
  await withE2ePrisma(async (prisma) => {
    await prisma.publicationSource.delete({ where: { id: fixture.sourceId } });
  });
}
