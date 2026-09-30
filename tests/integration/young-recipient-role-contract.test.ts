import { expect } from "vitest";
import { setYoungEventSubscription } from "@/features/young/server/young-subscription-service";
import { workspaceRuntimeTest as it } from "../shared/workspace-state-fixture";

it("maintenance can only discover recipients through its bounded function", async ({
  isolatedDatabase,
  workspaceRuntime,
}) => {
  const { owner: db, maintenance, app } = isolatedDatabase;
  const userId = `young-recipient-${crypto.randomUUID()}`;
  const youngId = `recipient-${crypto.randomUUID()}`;
  // The database owns all acquisition, including failure before the body completes.
  await workspaceRuntime.run(() =>
    db.$transaction(async (tx) => {
      await tx.user.create({
        data: { id: userId, email: `${userId}@test.invalid` },
      });
      await tx.youngEvent.create({
        data: { youngId, name: "Recipient fixture", rawJson: {}, isActive: true },
      });
    }),
  );
  await workspaceRuntime.run(async () => {
    await setYoungEventSubscription(userId, youngId, true);
    const rows = await maintenance.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.list_young_notification_recipients(NULL, 100)
    `;
    expect(rows.map((row) => row.id)).toEqual([userId]);
    await expect(
      maintenance.userYoungEventSubscription.findMany(),
    ).rejects.toThrow();
    await expect(app.$queryRaw`
      SELECT id FROM public.list_young_notification_recipients(NULL, 100)
    `).rejects.toThrow();
  });
});
