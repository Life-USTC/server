import {
  type CatalogContractFixture,
  createCatalogContractFixture,
} from "./catalog-contract-fixture";
import { nodeProtocolTest } from "./node-protocol-fixture";
import type { NodeProtocolRuntime } from "./node-protocol-runtime";
import type { TestPrismaClient } from "./prisma";

type CatalogRead = {
  db: TestPrismaClient;
  fixture: CatalogContractFixture;
  run: NodeProtocolRuntime["run"];
  request: NodeProtocolRuntime["request"];
  commitRevision(): Promise<void>;
};

export const catalogReadTest = nodeProtocolTest.extend<{
  catalogRead: CatalogRead;
}>({
  catalogRead: async ({ isolatedDatabase, protocolRuntime, task }, use) => {
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
    const fixture = await protocolRuntime.run(async () => {
      await commitRevision();
      return createCatalogContractFixture(db);
    });
    // Vitest can resume a late fixture after its native timeout. Finish the
    // owned setup, then preserve that original abort before publishing state.
    task.context.signal.throwIfAborted();
    await use({
      db,
      fixture,
      run: protocolRuntime.run,
      request: protocolRuntime.request,
      commitRevision,
    });
  },
});
