import { nodeProtocolTest } from "./node-protocol-fixture";
import { createTestPrisma, type TestPrismaClient } from "./prisma";
import { staticImporterConnection } from "./static-importer-connection";

export const staticImporterTest = nodeProtocolTest.extend<{
  importer: TestPrismaClient;
}>({
  importer: async (
    { isolatedDatabase, protocolRuntime, onTestFinished },
    use,
  ) => {
    const importer = createTestPrisma(
      staticImporterConnection(isolatedDatabase.name),
    );
    try {
      const [role] = await importer.$queryRaw<
        Array<{ currentUser: string; sessionUser: string }>
      >`SELECT current_user AS "currentUser", session_user AS "sessionUser"`;
      if (
        role.currentUser !== "life_ustc_importer" ||
        role.sessionUser !== "life_ustc_importer"
      )
        throw new Error(
          "Static import tests require the independent importer role",
        );
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
