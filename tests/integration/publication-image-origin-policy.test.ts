import { expect } from "vitest";
import { publicationFetchTest as it } from "../shared/publication-object-fixture";

// This file deliberately contains one scenario: its controlled fetch boundary
// belongs to one Vitest-isolated module and cannot race another case's spy.

it("publications.image-origin-policy", async ({ publication, fetchSpy }) => {
  await publication.run(async () => {
    const {
      db,
      bucket,
      marker,
      fixture,
      responseStatus,
      registerImage,
      imageRead,
    } = publication;
    const requested: string[] = [];
    let redirectTo: string | undefined;
    fetchSpy.mockImplementation(async (input) => {
      const url = String(input);
      requested.push(url);
      if (redirectTo && url.includes("/start.png"))
        return new Response(null, {
          status: 302,
          headers: { Location: redirectTo },
        });
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Type": "image/png" },
      });
    });
    const rejected = [
      "http://127.0.0.1/a.png",
      "http://[::1]/a.png",
      "https://localhost/a.png",
      "https://node.internal/a.png",
      "https://user:pass@cdn.example/a.png",
      "https://cdn.example:444/a.png",
      "ftp://cdn.example/a.png",
      "https://blocked.publication.example/a.png",
    ].map((url) => `${url}?case=${marker}`);
    for (const [index, url] of rejected.entries()) {
      const f = await fixture(`origin-reject-${index}`);
      await db.publicationSource.update({
        where: { id: f.payload.sources[0].id },
        data: { blockedHosts: ["blocked.publication.example"] },
      });
      const img = await registerImage(f, url);
      expect(await responseStatus(imageRead(img.hash))).toBe(404);
      expect(requested).toHaveLength(0);
      expect(await bucket.head(img.key)).toBeNull();
    }
    for (const [index, target] of [
      "https://cdn.example/accepted.png",
      "https://news.ustc.edu.cn/accepted.png",
      "https://sub.publication.example/accepted.png",
      "https://sub.cdn.example/rejected.png",
      "https://blocked.publication.example/rejected.png",
      "http://127.0.0.1/rejected.png",
    ].entries()) {
      const f = await fixture(`redirect-${index}`);
      await db.publicationSource.update({
        where: { id: f.payload.sources[0].id },
        data: { blockedHosts: ["blocked.publication.example"] },
      });
      const img = await registerImage(
        f,
        `https://cdn.example/${marker}/${index}/start.png`,
      );
      redirectTo = target;
      requested.length = 0;
      const response = await imageRead(img.hash);
      expect(response.status).toBe(index < 3 ? 200 : 502);
      expect(requested).toEqual(index < 3 ? [img.url, target] : [img.url]);
      if (index >= 3)
        expect(response.headers.get("cache-control")).toBe("no-store");
      await response.body?.cancel();
    }
  });
});
