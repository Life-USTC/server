import { vi } from "vitest";
import { publicYoungProtocolTest } from "../../../shared/public-young-protocol-fixture";

// fetch is process-global: keep this case in a separate native Vitest file so
// concurrent catalog consumers cannot share its spy. Restore only after all
// admitted workflow/request work and SDK handlers have finished, even on failure.
const contractTest = publicYoungProtocolTest.extend(
  "network",
  async ({
    protocolRuntime: _protocolRuntime,
    publicCatalogMcp: _publicCatalogMcp,
    onTestFinished,
  }) => {
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Upstream network unavailable"));
    // Test-scoped owners finish before onTestFinished. Each owner reports its
    // own failure; this fixture restores only the process-global spy it owns.
    onTestFinished(() => {
      network.mockRestore();
    });
    return network;
  },
);

contractTest(
  "young-event.static-snapshot-sourced",
  async ({ state, network, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const { youngId, publicDetails } = state;

      for (const event of await publicDetails())
        expect(event.youngId).toBe(youngId);
      expect(network).not.toHaveBeenCalled();
    }),
);
