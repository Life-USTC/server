import { expect, it } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { getCatalogDetailCacheRevision } from "@/lib/catalog-detail-cache-revision";
import { withRuntimeDatabaseAdapter } from "@/lib/db/prisma-adapter";
import { createFixturePrisma } from "../shared/prisma";

it("reads committed catalog revisions with the app role and preserves timestamp precision", async () => {
  const db = createFixturePrisma();
  const original = await db.staticImportState.findUnique({
    where: { id: "global" },
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
    await db.staticImportState.deleteMany({ where: { id: "global" } });
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
  } finally {
    if (original) {
      await db.staticImportState.upsert({
        where: { id: "global" },
        create: original,
        update: original,
      });
    } else {
      await db.staticImportState.deleteMany({ where: { id: "global" } });
    }
    await db.$disconnect();
  }
});
