import { nodeProtocolTest } from "./node-protocol-fixture";
import { createTestPrisma, type TestPrismaClient } from "./prisma";

export const staticImporterTest = nodeProtocolTest.extend<{
  importer: TestPrismaClient;
}>({
  importer: async (
    { isolatedDatabase, protocolRuntime, onTestFinished },
    use,
  ) => {
    // Production static sync uses the migrator role. Keep the importer separate
    // from the owner that prepares fixtures and observes committed results.
    const importer = createTestPrisma(isolatedDatabase.connections.owner);
    try {
      await use(importer);
    } finally {
      // Admitted workflows/requests finish before their importer is disconnected.
      // The enclosing runtime alone reports its cached cleanup failure.
      await Promise.allSettled([protocolRuntime.close()]);
      try {
        await importer.$disconnect();
      } catch (error) {
        // Let the outer runtime and private database release their resources.
        onTestFinished(() => {
          throw error;
        });
      }
    }
  },
});
