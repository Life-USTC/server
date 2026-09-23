import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { withE2ePrisma } from "./prisma";

export type PublicationFixture = {
  canonicalUrl: string;
  id: string;
  sourceId: string;
  sourceName: string;
  /**
   * A second registered source at a different organization level, so the
   * source directory and the list page's level filter have more than one
   * group to prove they actually group and filter (issue #1069).
   */
  officeSourceId: string;
  officeSourceName: string;
  officeTotal: number;
  title: string;
  total: number;
  imageId: string;
  imageUrl: string;
  markdownHash: string;
};

function localObjectCommand(
  action: "put" | "delete",
  key: string,
  body?: Buffer,
  contentType?: string,
) {
  execFileSync(
    "bunx",
    [
      "wrangler",
      "r2",
      "object",
      action,
      `life-ustc-publications/${key}`,
      "--local",
      "--config",
      process.env.E2E_WRANGLER_CONFIG ?? "wrangler.e2e.jsonc",
      ...(process.env.E2E_PERSIST_TO
        ? ["--persist-to", process.env.E2E_PERSIST_TO]
        : []),
      ...(body && contentType ? ["--pipe", "--content-type", contentType] : []),
    ],
    { input: body, timeout: 30_000, stdio: ["pipe", "pipe", "pipe"] },
  );
}

export async function createPublicationFixture(prefix: string) {
  const sourceId = `e2e-publication-${prefix}`;
  const sourceName = `E2E publication source ${prefix}`;
  const officeSourceId = `e2e-publication-office-${prefix}`;
  const officeSourceName = `E2E office source ${prefix}`;
  const officeTotal = 2;
  const canonicalUrl = `https://news.example.test/${prefix}`;
  const title = `E2E publication ${prefix}`;
  const revisionHash = "e".repeat(64);
  const total = 21;
  const publishedAt = new Date("2026-09-01T00:00:00+08:00");
  const imageSourceUrl = `https://news.ustc.edu.cn/e2e/${prefix}.png`;
  const imageId = createHash("sha256").update(imageSourceUrl).digest("hex");
  const imageUrl = `/api/publications/images/${imageId}`;
  const markdown = Buffer.from(
    [
      "This is the body text rendered by the public detail page.",
      "第二段正文，验证段间距与首行缩进。",
      `![Inline publication image](${imageUrl})`,
      "This paragraph follows the inline image.",
      `Fixture: ${prefix}`,
      '<script>throw new Error("untrusted article script")</script>',
    ].join("\n\n"),
  );
  const markdownHash = createHash("sha256").update(markdown).digest("hex");
  const markdownKey = `publications/body_markdown/sha256/${markdownHash.slice(0, 2)}/${markdownHash}`;
  localObjectCommand("put", markdownKey, markdown, "text/markdown");
  localObjectCommand(
    "put",
    `publications/images/url-sha256/${imageId}`,
    readFileSync("public/images/icon.png"),
    "image/png",
  );

  return withE2ePrisma(async (prisma) => {
    const markdownObject = await prisma.publicationObject.create({
      data: {
        kind: "body_markdown",
        sha256: markdownHash,
        size: markdown.byteLength,
        contentType: "text/markdown",
        r2Key: markdownKey,
        status: "verified",
      },
    });
    await prisma.publicationSource.create({
      data: {
        id: sourceId,
        name: sourceName,
        organizationLevel: "university",
        allowedHosts: ["news.example.test"],
      },
    });
    await prisma.publicationSource.create({
      data: {
        id: officeSourceId,
        name: officeSourceName,
        organizationLevel: "office",
        allowedHosts: ["office.example.test"],
      },
    });

    for (let index = 0; index < officeTotal; index += 1) {
      const officeTitle = `E2E office publication ${prefix} ${index + 1}`;
      const officeUrl = `https://office.example.test/${prefix}/${index + 1}`;
      const officePublishedAt = new Date(
        publishedAt.getTime() - (index + 1) * 86_400_000,
      );
      const officePublication = await prisma.publication.create({
        data: {
          sourceId: officeSourceId,
          canonicalUrl: officeUrl,
          title: officeTitle,
          publicationType: "notice",
          publishedAt: officePublishedAt,
        },
      });
      const officeRevision = await prisma.publicationRevision.create({
        data: {
          publicationId: officePublication.id,
          revisionHash: "f".repeat(64),
          observedAt: officePublishedAt,
          title: officeTitle,
          publishedAt: officePublishedAt,
          publicationType: "notice",
        },
      });
      await prisma.publication.update({
        where: { id: officePublication.id },
        data: { currentRevisionId: officeRevision.id },
      });
    }

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
          bodyText: "Legacy plain text must not be used as the rendered body.",
          sourcePageUrl: itemUrl,
          publishedAt: itemPublishedAt,
          publicationType: "news",
          objectLinks: {
            create: { objectId: markdownObject.id, role: "body_markdown" },
          },
          imageSourceRefs: {
            create: {
              imageSource: {
                connectOrCreate: {
                  where: { id: imageId },
                  create: { id: imageId, url: imageSourceUrl },
                },
              },
            },
          },
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
      sourceName,
      officeSourceId,
      officeSourceName,
      officeTotal,
      title,
      total,
      imageId,
      imageUrl,
      markdownHash,
    } satisfies PublicationFixture;
  });
}

export async function deletePublicationFixture(fixture: PublicationFixture) {
  await withE2ePrisma(async (prisma) => {
    await prisma.publicationSource.delete({ where: { id: fixture.sourceId } });
    await prisma.publicationSource.delete({
      where: { id: fixture.officeSourceId },
    });
    await prisma.publicationImageSource.delete({
      where: { id: fixture.imageId },
    });
    await prisma.publicationObject.delete({
      where: {
        kind_sha256: { kind: "body_markdown", sha256: fixture.markdownHash },
      },
    });
  });
  localObjectCommand(
    "delete",
    `publications/body_markdown/sha256/${fixture.markdownHash.slice(0, 2)}/${fixture.markdownHash}`,
  );
  localObjectCommand(
    "delete",
    `publications/images/url-sha256/${fixture.imageId}`,
  );
}
