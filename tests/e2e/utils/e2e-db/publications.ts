import { withE2ePrisma } from "./prisma";

export type PublicationFixture = {
  canonicalUrl: string;
  id: string;
  sourceId: string;
  title: string;
};

export async function createPublicationFixture(prefix: string) {
  const sourceId = `e2e-publication-${prefix}`;
  const canonicalUrl = `https://news.example.test/${prefix}`;
  const title = `E2E publication ${prefix}`;
  const revisionHash = "e".repeat(64);

  return withE2ePrisma(async (prisma) => {
    await prisma.publicationSource.create({
      data: {
        id: sourceId,
        name: `E2E publication source ${prefix}`,
        organizationLevel: "e2e",
        allowedHosts: ["news.example.test"],
      },
    });

    const publication = await prisma.publication.create({
      data: {
        sourceId,
        canonicalUrl,
        title,
        summary: "A deterministic publication used by the news page E2E test.",
        bodyText: "This is the body text rendered by the public detail page.",
        sourcePageUrl: canonicalUrl,
        publicationType: "news",
        publishedAt: new Date("2026-09-01T00:00:00+08:00"),
      },
    });
    const revision = await prisma.publicationRevision.create({
      data: {
        publicationId: publication.id,
        revisionHash,
        observedAt: new Date("2026-09-01T00:00:00+08:00"),
        title,
        summary: "A deterministic publication used by the news page E2E test.",
        bodyText: "This is the body text rendered by the public detail page.",
        sourcePageUrl: canonicalUrl,
        publishedAt: new Date("2026-09-01T00:00:00+08:00"),
        publicationType: "news",
      },
    });
    await prisma.publication.update({
      where: { id: publication.id },
      data: { currentRevisionId: revision.id },
    });

    return {
      canonicalUrl,
      id: publication.id,
      sourceId,
      title,
    } satisfies PublicationFixture;
  });
}

export async function deletePublicationFixture(fixture: PublicationFixture) {
  await withE2ePrisma(async (prisma) => {
    await prisma.publication.delete({ where: { id: fixture.id } });
    await prisma.publicationSource.delete({ where: { id: fixture.sourceId } });
  });
}
