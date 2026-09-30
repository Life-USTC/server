import { ownAnonymousMcpHarness } from "../integration/mcp/_harness/client";
import { nodeProtocolTest } from "./node-protocol-fixture";

/** Private catalog state, SDK transport, and workflow/request lifetimes. */
export const publicCatalogProtocolTest = nodeProtocolTest.extend<{
  _publicCatalogRevision: undefined;
  publicCatalogMcp: ReturnType<typeof ownAnonymousMcpHarness>;
}>({
  _publicCatalogRevision: async (
    { isolatedDatabase, protocolRuntime },
    use,
  ) => {
    // Private IDs repeat; the production L1 cache also needs a private revision.
    await protocolRuntime.run(() =>
      isolatedDatabase.owner.staticImportState.create({
        data: {
          id: "global",
          snapshotSha256: crypto.randomUUID().replaceAll("-", "").repeat(2),
          snapshotGeneratedAt: new Date(),
          transformRevision: 6,
        },
      }),
    );
    await use(undefined);
  },
  publicCatalogMcp: async (
    { protocolRuntime, _publicCatalogRevision, onTestFinished },
    use,
  ) => {
    const owned = ownAnonymousMcpHarness({ run: protocolRuntime.request });
    const failures: unknown[] = [];
    try {
      // Own the transport before any dependent fixture can initialize it.
      await use(owned);
    } catch (error) {
      failures.push(error);
    } finally {
      const results = await Promise.allSettled([owned.client.close()]);
      // The runtime owner reports its original cached rejection once.
      // Keep waiting here so no admitted workflow outlives this boundary.
      await Promise.allSettled([protocolRuntime.drain()]);
      failures.push(
        ...results.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        ),
      );
    }
    if (failures.length) {
      const error =
        failures.length === 1
          ? failures[0]
          : new AggregateError(failures, "Public catalog MCP lifecycle failed");
      onTestFinished(() => {
        throw error;
      });
    }
  },
});
