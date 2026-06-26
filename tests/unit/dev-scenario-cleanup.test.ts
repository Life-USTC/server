import { cleanupDevScenarioData } from "@tools/dev/seed/dev-scenario-cleanup";
import { describe, expect, it, type Mock, vi } from "vitest";

type PrismaMock = Record<string, Record<string, ReturnType<typeof vi.fn>>>;

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
                        methodKey === "findMany"
                          ? []
                          : methodKey === "count"
                            ? 0
                            : { count: 0 },
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
  ) as PrismaMock;

  return { prisma, methods };
}

describe("cleanupDevScenarioData", () => {
  it("clears Better Auth JWKS rows with the dev auth fixture state", async () => {
    const { prisma, methods } = createPrismaMock();

    await cleanupDevScenarioData(prisma as never, ["debug-user-id"], {
      removeBusVersion: false,
      removePersonalState: false,
    });

    expect(methods.get("jwks.deleteMany")).toHaveBeenCalledWith();
    expect(methods.get("session.deleteMany")).toHaveBeenCalled();
    expect(methods.get("account.deleteMany")).toHaveBeenCalled();
  });

  it("cleans generic audit logs for seeded and temp targets before and after teardown", async () => {
    const { prisma } = createPrismaMock();

    (prisma.user.findMany as Mock).mockResolvedValueOnce([
      {
        id: "temp-user-id",
        comments: [{ id: "temp-comment-id" }],
        uploads: [{ id: "temp-upload-id" }],
      },
    ]);
    (prisma.comment.findMany as Mock).mockResolvedValueOnce([
      { id: "scenario-comment-id" },
    ]);
    (prisma.upload.findMany as Mock).mockResolvedValueOnce([
      { id: "scenario-upload-id" },
    ]);
    (prisma.description.findMany as Mock).mockResolvedValueOnce([
      { id: "scenario-description-id" },
    ]);

    await cleanupDevScenarioData(prisma as never, ["debug-user-id"], {
      removeBusVersion: false,
      removePersonalState: false,
    });

    const expectedAuditCleanup = {
      where: {
        OR: [
          { userId: { in: ["debug-user-id"] } },
          {
            targetType: "user",
            targetId: { in: ["debug-user-id", "temp-user-id"] },
          },
          {
            targetType: "comment",
            targetId: { in: ["scenario-comment-id", "temp-comment-id"] },
          },
          {
            targetType: "upload",
            targetId: { in: ["scenario-upload-id", "temp-upload-id"] },
          },
          {
            targetType: "description",
            targetId: { in: ["scenario-description-id"] },
          },
        ],
      },
    };

    expect(prisma.auditLog.deleteMany).toHaveBeenNthCalledWith(
      1,
      expectedAuditCleanup,
    );
    expect(prisma.auditLog.deleteMany).toHaveBeenLastCalledWith(
      expectedAuditCleanup,
    );
  });
});
