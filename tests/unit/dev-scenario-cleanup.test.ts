import { cleanupDevScenarioData } from "@tools/dev/seed/dev-scenario-cleanup";
import type { ToolPrismaClient } from "@tools/shared/tool-prisma";
import { describe, expect, it, vi } from "vitest";

function createPrismaMock() {
  const methods = new Map<string, ReturnType<typeof vi.fn>>();
  const delegates = new Map<string, unknown>();

  const prisma = new Proxy(
    {},
    {
      get(_target, modelKey) {
        if (typeof modelKey !== "string") return undefined;
        if (!delegates.has(modelKey)) {
          delegates.set(
            modelKey,
            new Proxy(
              {},
              {
                get(_delegateTarget, methodKey) {
                  if (typeof methodKey !== "string") return undefined;
                  const key = `${modelKey}.${methodKey}`;
                  if (!methods.has(key)) {
                    methods.set(
                      key,
                      vi.fn(async () =>
                        methodKey === "findMany" ? [] : { count: 0 },
                      ),
                    );
                  }
                  return methods.get(key);
                },
              },
            ),
          );
        }
        return delegates.get(modelKey);
      },
    },
  ) as ToolPrismaClient;

  return { prisma, methods };
}

describe("cleanupDevScenarioData", () => {
  it("clears Better Auth JWKS rows with the dev auth fixture state", async () => {
    const { prisma, methods } = createPrismaMock();

    await cleanupDevScenarioData(prisma, ["debug-user-id"], {
      removeBusVersion: false,
      removePersonalState: false,
    });

    expect(methods.get("jwks.deleteMany")).toHaveBeenCalledWith();
    expect(methods.get("session.deleteMany")).toHaveBeenCalled();
    expect(methods.get("account.deleteMany")).toHaveBeenCalled();
  });
});
