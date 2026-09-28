import {
  type CatalogContractFixture,
  createCatalogContractFixture,
} from "./catalog-contract-fixture";
import { isolatedDatabaseTest } from "./isolated-database";
import { createNodeRuntime } from "./node-runtime";
import type { TestPrismaClient } from "./prisma";

type CatalogRead = {
  db: TestPrismaClient;
  fixture: CatalogContractFixture;
  request: ReturnType<typeof createNodeRuntime>["run"];
  commitRevision(): Promise<void>;
};

export const catalogReadTest = isolatedDatabaseTest.extend<{
  _catalogRuntime: ReturnType<typeof createNodeRuntime>;
  catalogRead: CatalogRead;
}>({
  _catalogRuntime: async ({ isolatedDatabase }, use) => {
    const runtime = createNodeRuntime({
      HYPERDRIVE: { connectionString: isolatedDatabase.connections.app },
      HYPERDRIVE_AUTH: { connectionString: isolatedDatabase.connections.auth },
    });
    try {
      // Register ownership before dependent setup can issue any requests.
      await use(runtime);
    } finally {
      await runtime.close();
    }
  },
  catalogRead: async ({ isolatedDatabase, _catalogRuntime }, use) => {
    const db = isolatedDatabase.owner;
    async function commitRevision() {
      const data = {
        snapshotSha256: crypto.randomUUID().replaceAll("-", "").repeat(2),
        snapshotGeneratedAt: new Date(),
        transformRevision: 6,
      };
      await db.staticImportState.upsert({
        where: { id: "global" },
        create: { id: "global", ...data },
        update: data,
      });
    }
    // Local database IDs can repeat. An owned initial revision also separates
    // their production cache keys without clearing another case's memory cache.
    await commitRevision();
    const fixture = await createCatalogContractFixture(db);
    await use({ db, fixture, request: _catalogRuntime.run, commitRevision });
  },
});
