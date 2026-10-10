import { expect } from "vitest";
import { publicationFetchTest as it } from "../shared/publication-object-fixture";

// This file deliberately contains one scenario: its controlled fetch boundary
// belongs to one Vitest-isolated module and cannot race another case's spy.

it("publications.image-response-validation", {
  tags: ["@Publication/REST"],
}, async ({ publication, fetchSpy }) => {
  await publication.run(async () => {
    const { bucket, marker, fixture, registerImage, imageRead } = publication;
    let responseFactory: () => Response;
    fetchSpy.mockImplementation(async () => responseFactory());
    const limit = 10 * 1024 * 1024;
    let cancelled = false;
    let streamed = 0;
    const invalidResponses: Array<() => Response> = [
      () =>
        new Response("<svg/>", {
          headers: { "Content-Type": "image/svg+xml" },
        }),
      () =>
        new Response("<html/>", { headers: { "Content-Type": "text/html" } }),
      () =>
        new Response(new Uint8Array(0), {
          headers: { "Content-Type": "image/png" },
        }),
      () => new Response("missing", { status: 404 }),
      () =>
        new Response(new Uint8Array([1]), {
          headers: {
            "Content-Type": "image/png",
            "Content-Length": String(limit + 1),
          },
        }),
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              streamed += 64 * 1024;
              controller.enqueue(new Uint8Array(64 * 1024));
            },
            cancel() {
              cancelled = true;
            },
          }),
          { headers: { "Content-Type": "image/png" } },
        ),
    ];
    for (const [index, makeResponse] of invalidResponses.entries()) {
      const f = await fixture(`response-${index}`);
      const img = await registerImage(
        f,
        `https://cdn.example/${marker}/response-${index}.png`,
      );
      responseFactory = makeResponse;
      const response = await imageRead(img.hash);
      expect(response.status).toBe(502);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await bucket.head(img.key)).toBeNull();
      await response.body?.cancel();
    }
    expect(cancelled).toBe(true);
    expect(streamed).toBeLessThanOrEqual(limit + 2 * 64 * 1024);
    const f = await fixture("response-boundary");
    const img = await registerImage(
      f,
      `https://cdn.example/${marker}/boundary.png`,
    );
    responseFactory = () =>
      new Response(new Uint8Array(limit), {
        headers: { "Content-Type": "image/png" },
      });
    const response = await imageRead(img.hash);
    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBe(limit);
    expect((await bucket.head(img.key))?.size).toBe(limit);
  });
});
