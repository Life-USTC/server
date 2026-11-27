import { expect, it } from "vitest";
import { getCatalogDetailCacheRevision } from "@/features/catalog/server/catalog-detail-cache-revision";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { withRuntimeDatabaseAdapter } from "@/lib/db/prisma-adapter";
import { createFixturePrisma } from "../shared/prisma";

it("reads committed catalog revisions with the app role and preserves timestamp precision", {
  tags: ["@StaticImport/Runtime"],
}, async () => {
  const db = createFixturePrisma();
  const ids = ["global", "section-page-core", "section-page-core-source"];
  const original = await db.staticImportState.findMany({
    where: { id: { in: ids } },
  });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Missing app database URL");
  const request = <T>(action: () => Promise<T>) =>
    runWithCloudflareRuntimeEnv({ HYPERDRIVE: { connectionString } }, action);
  try {
    const role = await request(() =>
      withRuntimeDatabaseAdapter("app", (adapter) =>
        adapter.queryRaw({
          sql: "SELECT current_user",
          args: [],
          argTypes: [],
        }),
      ),
    );
    expect(role.rows).toEqual([[new URL(connectionString).username]]);
    await db.staticImportState.deleteMany({ where: { id: { in: ids } } });
    expect(await request(getCatalogDetailCacheRevision)).toBe(
      "schema2:bootstrap",
    );

    await db.staticImportState.create({
      data: {
        id: "global",
        snapshotSha256: "0123456789abcdef".repeat(4),
        snapshotGeneratedAt: new Date("2026-08-16T03:00:00.123Z"),
        updatedAt: new Date("2026-08-16T03:00:00.123Z"),
        transformRevision: 1,
      },
    });
    const first = await request(getCatalogDetailCacheRevision);
    expect(first).toBe("schema2:0123456789abcdef-msv7vmrf");
    await request(async () => {
      expect(await getCatalogDetailCacheRevision()).toBe(first);
      await db.staticImportState.update({
        where: { id: "global" },
        data: { updatedAt: new Date("2026-08-16T03:01:00.123Z") },
      });
      // Reads already made in this request share one committed revision.
      expect(await getCatalogDetailCacheRevision()).toBe(first);
    });
    // The very next request observes rematerialization of the same snapshot.
    expect(await request(getCatalogDetailCacheRevision)).toBe(
      "schema2:0123456789abcdef-msv7wx23",
    );
    const sectionRevision = () =>
      request(() => getCatalogDetailCacheRevision("section"));
    const globalRevision = () => request(getCatalogDetailCacheRevision);
    const snapshot = await db.staticImportState.findUniqueOrThrow({
      where: { id: "global" },
    });
    await db.staticImportState.create({
      data: {
        ...snapshot,
        id: "section-page-core",
        snapshotSha256: "a".repeat(64),
      },
    });
    expect(await sectionRevision()).toBe(await globalRevision());
    await db.staticImportState.create({
      data: { ...snapshot, id: "section-page-core-source" },
    });
    const tracked = await sectionRevision();
    expect(tracked).toMatch(/^schema2:aaaaaaaaaaaaaaaa-/);
    const next = "b".repeat(64);
    await db.staticImportState.updateMany({
      where: { id: { in: ["global", "section-page-core-source"] } },
      data: { snapshotSha256: next },
    });
    expect(await sectionRevision()).toBe(tracked);
    await db.staticImportState.update({
      where: { id: "global" },
      data: { snapshotSha256: "c".repeat(64) },
    });
    expect(await sectionRevision()).toBe(await globalRevision());
    await db.staticImportState.update({
      where: { id: "global" },
      data: { snapshotSha256: next, transformRevision: 2 },
    });
    expect(await sectionRevision()).toBe(await globalRevision());
  } finally {
    await db.$transaction([
      db.staticImportState.deleteMany({ where: { id: { in: ids } } }),
      db.staticImportState.createMany({ data: original }),
    ]);
    await db.$disconnect();
  }
});
