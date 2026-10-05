import { createHash } from "node:crypto";
import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/publication-fixture";

test("publications.markdown-presentation", { tag: "@Publication/Web" }, async ({
  browseRun,
  page,
  publication: f,
  publicationObjects,
  isolatedWorker,
}) => {
  await browseRun(async () => {
    const asset = Buffer.from(`PDF fixture ${crypto.randomUUID()}`);
    const hash = createHash("sha256").update(asset).digest("hex");
    const key = `publications/asset/sha256/${hash.slice(0, 2)}/${hash}`;
    const filename = "Planning notes <b>source</b>.pdf";
    const caption = "<img src=x onerror=alert(1)> Plain caption";
    const title = 'Revision title " onerror="alert(1)';
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await publicationObjects.put(key, asset, "application/pdf");
    expect(await publicationObjects.get(key)).toEqual(asset);
    const missing = await isolatedWorker.database.owner.$transaction(
      async (db) => {
        const publication = await db.publication.findUniqueOrThrow({
          where: { id: f.id },
        });
        const revisionId = publication.currentRevisionId;
        if (!revisionId) throw new Error("Missing current revision");
        await db.publicationRevision.update({
          where: { id: revisionId },
          data: {
            author: "Article author",
            reporter: "Article reporter",
            editor: "Article editor",
            originalPublisher: "Original publisher",
          },
        });
        await db.publicationRevisionImageSource.update({
          where: {
            revisionId_imageSourceId: { revisionId, imageSourceId: f.imageId },
          },
          data: { altText: "Revision image description", title, caption },
        });
        const object = await db.publicationObject.create({
          data: {
            kind: "asset",
            sha256: hash,
            r2Key: key,
            size: asset.byteLength,
            contentType: "application/pdf",
            status: "verified",
            verifiedAt: new Date(),
          },
        });
        await db.publicationObjectLink.create({
          data: { revisionId, objectId: object.id, role: "asset", filename },
        });
        const missing = await db.publication.create({
          data: {
            sourceId: f.sourceId,
            canonicalUrl: `${f.canonicalUrl}/no-body`,
            title: "No Markdown",
            publicationType: "news",
          },
        });
        const revision = await db.publicationRevision.create({
          data: {
            publicationId: missing.id,
            revisionHash: "a".repeat(64),
            observedAt: new Date(),
            publicationType: "news",
            title: "No Markdown",
            bodyText: "Private fallback must not render",
          },
        });
        await db.publication.update({
          where: { id: missing.id },
          data: { currentRevisionId: revision.id },
        });
        return missing.id;
      },
    );
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await gotoAndWaitForReady(page, `/news/${f.id}`);
      const body = page.locator(".publication-body");
      const image = body.getByRole("img", {
        name: "Revision image description",
        exact: true,
      });
      await expect(image).toHaveAttribute("src", f.imageUrl);
      await expect(image).toHaveAttribute("title", title);
      await expect(body.locator("figcaption")).toHaveText(caption);
      await expect(
        body.locator("figcaption img, script, [onerror]"),
      ).toHaveCount(0);
      const blocks = await body
        .locator(":scope > p, :scope > figure")
        .evaluateAll((nodes) =>
          nodes.map((node) =>
            node.tagName === "FIGURE" ? "image" : node.textContent,
          ),
        );
      expect(blocks.slice(0, 4)).toEqual([
        "This is the body text rendered by the public detail page.",
        "第二段正文，验证段间距与首行缩进。",
        "image",
        "This paragraph follows the inline image.",
      ]);
      for (const name of [
        "Article author",
        "Article reporter",
        "Article editor",
        "Original publisher",
      ])
        await expect(
          page.locator("dd").filter({ hasText: new RegExp(`^${name}$`) }),
        ).toBeVisible();
      const download = page.getByRole("link", { name: filename, exact: false });
      await expect(download).toHaveAttribute(
        "href",
        `/api/publications/objects/asset/${hash}`,
      );
      await expect(download.locator("b")).toHaveCount(0);
      await expect(
        page.getByText(
          "Legacy plain text must not be used as the rendered body.",
        ),
      ).toHaveCount(0);
      await gotoAndWaitForReady(page, `/news/${missing}`);
      await expect(
        page.getByText("Private fallback must not render"),
      ).toHaveCount(0);
      await expect(page.locator(".publication-body")).toContainText(
        /正文|body|content/i,
      );
    }
    expect(errors).toEqual([]);
  });
});
