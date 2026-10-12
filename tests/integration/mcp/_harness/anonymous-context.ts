import { test } from "vitest";
import { createNodeProtocolRuntime } from "../../../shared/node-protocol-runtime";
import { ownAnonymousMcpHarness } from "./client";

/** Public transport comparisons own SDK cancellation before workflow drain. */
export const anonymousMcpTest = test.extend<{
  protocolRuntime: ReturnType<typeof createNodeProtocolRuntime>;
  anonymousSession: ReturnType<typeof ownAnonymousMcpHarness>;
}>({
  protocolRuntime: async ({ onTestFinished }, use) => {
    const runtime = createNodeProtocolRuntime({
      APP_PUBLIC_ORIGIN: "https://example.test",
      APP_CANONICAL_ORIGIN: "https://example.test",
    });
    try {
      await use(runtime);
    } finally {
      try {
        await runtime.close();
      } catch (error) {
        onTestFinished(() => {
          throw error;
        });
      }
    }
  },
  anonymousSession: async ({ protocolRuntime, onTestFinished }, use) => {
    const session = ownAnonymousMcpHarness({ run: protocolRuntime.request });
    try {
      await use(session);
    } finally {
      try {
        await session.client.close();
      } catch (error) {
        onTestFinished(() => {
          throw error;
        });
      }
      // The runtime fixture reports its own cached error after releasing all
      // requests. Closing the SDK first can release their pending handlers.
      await Promise.allSettled([protocolRuntime.close()]);
    }
  },
});
