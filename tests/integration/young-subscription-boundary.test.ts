import { expect, vi } from "vitest";
import { setYoungEventSubscription } from "@/features/young/server/young-subscription-service";
import { youngWorkspaceTest as it } from "../shared/young-workspace-fixture";

// This case owns the process-global network spy. Vitest isolates this file.
it("young-workspace.subscription", async ({ young }) => {
  const { db: fixture, userId, youngId } = young;
  await young.runtime(async () => {
    const original = await fixture.youngEvent.findUniqueOrThrow({
      where: { youngId },
    });
    const fetch = vi.fn(async () => {
      throw new Error("No official registration request is authorized");
    });
    vi.stubGlobal("fetch", fetch);
    try {
      expect(
        await setYoungEventSubscription(userId, youngId, true),
      ).toMatchObject({ youngId, subscribed: true });
      expect(
        await fixture.userYoungEventSubscription.count({
          where: { userId, youngId },
        }),
      ).toBe(1);
      expect(
        await setYoungEventSubscription(userId, youngId, false),
      ).toMatchObject({ youngId, subscribed: false });
      expect(
        await fixture.userYoungEventSubscription.count({
          where: { userId, youngId },
        }),
      ).toBe(0);
      expect(
        await fixture.youngEvent.findUniqueOrThrow({ where: { youngId } }),
      ).toEqual(original);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
