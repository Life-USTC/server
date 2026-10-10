import { ownAnonymousMcpHarness } from "../integration/mcp/_harness/client";
import { withMcpSdkLifecycle } from "./mcp-sdk-lifecycle";
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
    // Own the transport before any dependent fixture can initialize it.
    await withMcpSdkLifecycle(
      { protocolRuntime, onTestFinished },
      [owned],
      "Public catalog MCP lifecycle failed",
      () => use(owned),
    );
  },
});
