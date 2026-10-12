import { expect } from "vitest";
import { publicationFetchTest as it } from "../shared/publication-object-fixture";

// This file deliberately contains one scenario: its controlled fetch boundary
// belongs to one Vitest-isolated module and cannot race another case's spy.

it("publications.image-archive", { tags: ["@Publication/REST"] }, async ({
  publication,
  fetchSpy,
}) => {
  await publication.run(async () => {
    const {
      bucket,
      marker,
      fixture,
      responseStatus,
      registerImage,
      imageRead,
    } = publication;
    const f = await fixture("image-archive");
    const img = await registerImage(
      f,
      `https://cdn.example/${marker}/archive.png`,
    );
    let succeed = false;
    const bytes = new Uint8Array([137, 80, 78, 71]);
    fetchSpy.mockImplementation(async () =>
      succeed
        ? new Response(bytes, { headers: { "Content-Type": "image/png" } })
        : new Response("unavailable", { status: 503 }),
    );
    expect(await responseStatus(imageRead(img.hash))).toBe(502);
    expect(await bucket.head(img.key)).toBeNull();
    succeed = true;
    const first = await imageRead(img.hash);
    expect(first.status).toBe(200);
    expect(new Uint8Array(await first.arrayBuffer())).toEqual(bytes);
    expect(first.headers.get("cache-control")).not.toContain("immutable");
    const head = await bucket.head(img.key);
    expect(head).toMatchObject({
      size: bytes.length,
      httpMetadata: { contentType: "image/png" },
    });
    succeed = false;
    const cached = await imageRead(img.hash);
    expect(cached.status).toBe(200);
    expect(new Uint8Array(await cached.arrayBuffer())).toEqual(bytes);
    expect(cached.headers.get("etag")).toBe(`"${head?.etag}"`);
    const etag = cached.headers.get("etag");
    if (!etag) throw new Error("Expected archived image ETag");
    expect(
      await responseStatus(
        imageRead(img.hash, {
          "If-None-Match": etag,
        }),
      ),
    ).toBe(304);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
