import { createHash } from "node:crypto";
import { expect } from "@playwright/test";
import { test } from "../../../e2e/utils/publication-fixture";

test("publication detail returns canonical rendered Markdown over HTTP", {
  tag: "@Publication/REST",
}, async ({
  run,
  request,
  isolatedWorker,
  publication: fixture,
  publicationObjects,
}) => {
  await run(async () => {
    const markdown = [
      "Before the image.",
      `![Original alt](${fixture.imageUrl})`,
      "After the image.",
      "| Session | Room | Time |\n| --- | --- | --- |\n| Workshop | East 101 | 8:30~9:30 |\n| Seminar | West 102 | 9:30~10:00 |\n| Discussion | East 103 | 10:00~10:20 |",
      "Start:08:30:00; note:morning.",
      "$x^2$",
      "[Unsafe link](javascript:alert(1))",
    ].join("\n\n");
    const bytes = Buffer.from(markdown);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const key = `publications/body_markdown/sha256/${hash.slice(0, 2)}/${hash}`;
    await publicationObjects.put(key, bytes, "text/markdown");
    await isolatedWorker.database.owner.$transaction(async (db) => {
      const publication = await db.publication.findUniqueOrThrow({
        where: { id: fixture.id },
      });
      const revisionId = publication.currentRevisionId;
      if (!revisionId) throw new Error("Expected publication revision");
      const object = await db.publicationObject.create({
        data: {
          kind: "body_markdown",
          sha256: hash,
          size: bytes.length,
          r2Key: key,
          contentType: "text/markdown",
          status: "verified",
        },
      });
      await db.publicationObjectLink.updateMany({
        where: { revisionId, role: "body_markdown" },
        data: { objectId: object.id },
      });
      await db.publicationRevisionImageSource.update({
        where: {
          revisionId_imageSourceId: {
            revisionId,
            imageSourceId: fixture.imageId,
          },
        },
        data: {
          altText: "Revision alt",
          title: "Revision title",
          caption: "<script>Plain caption</script>",
        },
      });
    });

    const response = await request.get(`/api/publications/${fixture.id}`);
    expect(response.status()).toBe(200);
    const detail = await response.json();
    expect(detail.revision.bodyMarkdown).toBe(markdown);
    const html = detail.renderedBodyHtml;
    expect(html).toContain(`src="${fixture.imageUrl}"`);
    expect(html).toContain('alt="Revision alt"');
    expect(html).toContain('title="Revision title"');
    expect(html).toContain(
      "<figcaption>&#x3C;script>Plain caption&#x3C;/script></figcaption>",
    );
    expect(html.indexOf("Before the image.")).toBeLessThan(
      html.indexOf("<figure>"),
    );
    expect(html.indexOf("<figure>")).toBeLessThan(
      html.indexOf("After the image."),
    );
    expect(html).toContain("<table>");
    expect(html).toContain("<td>East 101</td>");
    for (const time of ["8:30~9:30", "9:30~10:00", "10:00~10:20"])
      expect(html).toContain(`<td>${time}</td>`);
    expect(html).toContain("Start:08:30:00; note:morning.");
    expect(html).toContain('class="katex"');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("Legacy plain text");

    const listed = await request.get("/api/publications", {
      params: { source: fixture.sourceId },
    });
    expect(listed.status()).toBe(200);
    for (const item of (await listed.json()).data) {
      expect(item).not.toHaveProperty("renderedBodyHtml");
      expect(item.revision).not.toHaveProperty("bodyMarkdown");
    }
  });
});

test("publication detail leaves rendered HTML empty without Markdown", {
  tag: "@Publication/REST",
}, async ({ run, request, isolatedWorker, publication: fixture }) => {
  await run(async () => {
    const db = isolatedWorker.database.owner;
    const publication = await db.publication.findFirstOrThrow({
      where: { sourceId: fixture.officeSourceId },
    });
    if (!publication.currentRevisionId)
      throw new Error("Expected office publication revision");
    await db.publicationRevision.update({
      where: { id: publication.currentRevisionId },
      data: { bodyText: "Do not render this text in place of Markdown." },
    });
    const response = await request.get(`/api/publications/${publication.id}`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      renderedBodyHtml: "",
      revision: {
        bodyMarkdown: null,
        bodyText: "Do not render this text in place of Markdown.",
      },
    });
  });
});
