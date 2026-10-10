import { expect } from "vitest";
import { adminBusActions } from "@/features/admin/server/admin-bus-page-server";
import { busAuditTest as it } from "../shared/bus-audit-fixture";

it("audit.action-admin-bus-version-activate", {
  tags: ["@Admin/Web"],
}, async ({ bus }) => {
  const { db, marker, userId, event, run } = bus;
  const version = await db.busScheduleVersion.create({
    data: {
      key: `bus-audit-${marker}`,
      checksum: marker,
      rawJson: {},
      title: `private title ${marker}`,
      isEnabled: false,
    },
  });
  const before = await db.busScheduleVersion.findMany({
    orderBy: { id: "asc" },
  });
  await expect(
    run(() =>
      adminBusActions.activateVersion(
        event(version.id, "invalid\u0000audit-request"),
      ),
    ),
  ).rejects.toThrow();
  expect(
    await db.busScheduleVersion.findMany({ orderBy: { id: "asc" } }),
  ).toEqual(before);
  expect(
    await db.auditLog.count({
      where: { userId, action: "admin_bus_version_activate" },
    }),
  ).toBe(0);
  expect(
    await run(() => adminBusActions.activateVersion(event(version.id))),
  ).toMatchObject({ variant: "default" });
  expect(
    await db.busScheduleVersion.findMany({
      where: { isEnabled: true },
      select: { id: true },
    }),
  ).toEqual([{ id: version.id }]);
  const rows = await db.auditLog.findMany({
    where: { userId, action: "admin_bus_version_activate" },
  });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    userId,
    channel: "web",
    targetId: String(version.id),
    targetType: "bus_schedule_version",
    metadata: null,
  });
  expect(JSON.stringify(rows)).not.toContain(version.title);
});
