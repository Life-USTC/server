import { expect } from "@playwright/test";
import { test } from "../../../../e2e/utils/owned-worker";

const base = "/api/workspace/link-pins";
const headers = { accept: "application/json" };
test(
  "anonymous JSON pin returns 401 and HTML pin redirects",
  { tag: "@CatalogLink/REST" },
  async ({ request, run }) =>
    run(async () => {
      const form = { slug: "jw", action: "pin", returnTo: "/catalog/links" };
      const json = await request.post(base, { form, headers });
      expect(json.status()).toBe(401);
      expect(await json.json()).toMatchObject({
        pinnedSlugs: [],
        maxPinnedLinks: 4,
      });
      const html = await request.post(base, { form, maxRedirects: 0 });
      expect(html.status()).toBe(303);
    }),
);

test(
  "known pins are listed in creation order for only their owner",
  { tag: "@CatalogLink/REST" },
  async ({ isolatedWorker, run }) =>
    run(async () => {
      const { createActor } = isolatedWorker;
      const db = isolatedWorker.database.owner;
      const owner = await createActor();
      const other = await createActor();
      await db.workspaceLinkPin.createMany({
        data: [
          { userId: owner.id, slug: "vlab", createdAt: new Date("2026-01-01") },
          { userId: owner.id, slug: "jw", createdAt: new Date("2026-01-02") },
          { userId: other.id, slug: "mail" },
        ],
      });
      const response = await owner.request.get(base);
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        pinnedSlugs: ["vlab", "jw"],
        maxPinnedLinks: 4,
      });
    }),
);

for (const action of ["pin", "unpin"] as const) {
  test(
    `${action} persists only the current owner's pins and is idempotent`,
    { tag: "@CatalogLink/REST" },
    async ({ isolatedWorker, run }) =>
      run(async () => {
        const { createActor } = isolatedWorker;
        const db = isolatedWorker.database.owner;
        const owner = await createActor();
        const other = await createActor();
        await db.workspaceLinkPin.createMany({
          data: [
            { userId: other.id, slug: "vlab" },
            ...(action === "unpin" ? [{ userId: owner.id, slug: "vlab" }] : []),
          ],
        });
        const otherBefore = await db.workspaceLinkPin.findMany({
          where: { userId: other.id },
        });
        for (let attempt = 0; attempt < 2; attempt++) {
          const response = await owner.request.post(base, {
            form: { slug: "vlab", action, returnTo: "/" },
            headers,
          });
          expect(response.status()).toBe(200);
          expect(await response.json()).toMatchObject({
            pinnedSlugs: action === "pin" ? ["vlab"] : [],
            maxPinnedLinks: 4,
          });
        }
        expect(
          await db.workspaceLinkPin.findMany({
            where: { userId: owner.id },
            select: { slug: true },
          }),
        ).toEqual(action === "pin" ? [{ slug: "vlab" }] : []);
        expect(
          await db.workspaceLinkPin.findMany({ where: { userId: other.id } }),
        ).toEqual(otherBefore);
        const read = await owner.request.get(base);
        expect(read.status()).toBe(200);
        expect((await read.json()).pinnedSlugs).toEqual(
          action === "pin" ? ["vlab"] : [],
        );
      }),
  );
}

test(
  "a fifth pin evicts only the oldest pin",
  { tag: "@CatalogLink/REST" },
  async ({ isolatedWorker, run }) =>
    run(async () => {
      const { createActor } = isolatedWorker;
      const db = isolatedWorker.database.owner;
      const owner = await createActor();
      await db.workspaceLinkPin.createMany({
        data: ["jw", "mail", "library", "official"].map((slug, index) => ({
          userId: owner.id,
          slug,
          createdAt: new Date(`2026-01-0${index + 1}`),
        })),
      });
      const response = await owner.request.post(base, {
        form: { slug: "vlab", action: "pin", returnTo: "/" },
        headers,
      });
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        pinnedSlugs: ["mail", "library", "official", "vlab"],
        maxPinnedLinks: 4,
      });
      expect(
        await db.workspaceLinkPin.findMany({
          where: { userId: owner.id },
          select: { slug: true },
          orderBy: { createdAt: "asc" },
        }),
      ).toEqual(
        ["mail", "library", "official", "vlab"].map((slug) => ({ slug })),
      );
    }),
);

for (const slug of ["", "nonexistent-slug-e2e"]) {
  test(
    `rejects ${slug || "missing slug"} without changing known pins`,
    { tag: "@CatalogLink/REST" },
    async ({ isolatedWorker, run }) =>
      run(async () => {
        const { createActor } = isolatedWorker;
        const db = isolatedWorker.database.owner;
        const owner = await createActor();
        await db.workspaceLinkPin.create({
          data: { userId: owner.id, slug: "jw" },
        });
        const before = await db.workspaceLinkPin.findMany({
          where: { userId: owner.id },
        });
        const response = await owner.request.post(base, {
          form: { ...(slug ? { slug } : {}), action: "pin", returnTo: "/" },
          headers,
        });
        expect(response.status()).toBe(400);
        if (slug)
          expect(await response.json()).toMatchObject({
            error: "invalid_slug",
            pinnedSlugs: ["jw"],
            maxPinnedLinks: 4,
          });
        expect(
          await db.workspaceLinkPin.findMany({ where: { userId: owner.id } }),
        ).toEqual(before);
      }),
  );
}

test(
  "authenticated HTML pin redirects after persisting the pin",
  { tag: "@CatalogLink/REST" },
  async ({ isolatedWorker, run }) =>
    run(async () => {
      const { createActor } = isolatedWorker;
      const db = isolatedWorker.database.owner;
      const owner = await createActor();
      const response = await owner.request.post(base, {
        form: { slug: "jw", action: "pin", returnTo: "/catalog/links" },
        maxRedirects: 0,
      });
      expect(response.status()).toBe(303);
      expect(new URL(response.headers().location).pathname).toBe(
        "/catalog/links",
      );
      expect(
        await db.workspaceLinkPin.findMany({
          where: { userId: owner.id },
          select: { slug: true },
        }),
      ).toEqual([{ slug: "jw" }]);
    }),
);
