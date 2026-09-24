import { describe, expect, it } from "vitest";
import { annotatePublicationImages } from "@/features/publications/lib/publication-image-metadata";

const image = {
  id: "hash",
  url: "/api/publications/images/hash",
  altText: 'A "quoted" image',
  title: "Image title",
  caption: '<script>alert("x")</script>',
};
describe("publication image annotations", () => {
  it("adds escaped text captions and accessible image metadata", () => {
    const html = annotatePublicationImages(
      '<p><img src="/api/publications/images/hash" alt="old"></p>',
      [image],
    );
    expect(html).toContain("<figure>");
    expect(html).toContain('title="Image title"');
    expect(html).toContain('alt="A &#x22;quoted&#x22; image"');
    expect(html).toContain("<figcaption>&#x3C;script>");
    expect(html).not.toContain("<script>");
  });
  it("keeps inline images in their paragraph and leaves unregistered sources alone", () => {
    const html = annotatePublicationImages(
      '<p>Text <img src="/api/publications/images/hash"></p><p><img src="/other"></p>',
      [image],
    );
    expect(html).not.toContain("<figure>");
    expect(html).toContain('<img src="/other">');
  });
});

it("does not duplicate a caption already preserved in the article Markdown", () => {
  const html = annotatePublicationImages(
    '<p><img src="/api/publications/images/hash"></p><p>Existing <em>caption</em></p>',
    [{ ...image, caption: "Existing caption" }],
  );
  expect(html).not.toContain("<figcaption>");
  expect(html).toContain("Existing <em>caption</em>");
});
