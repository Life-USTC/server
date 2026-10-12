import { expect, vi } from "vitest";
import { adminBusActions } from "@/features/admin/server/admin-bus-page-server";
import { getBusDataUrl } from "@/features/bus/lib/bus-static-source";
import type { BusStaticPayload } from "@/features/bus/lib/bus-types";
import { busAuditTest as it } from "../shared/bus-audit-fixture";

// Own the global fetch stub in a one-case file; Vitest isolates file globals.
it("audit.action-admin-bus-import", { tags: ["@Admin/Web"] }, async ({
  bus,
}) => {
  const { db, marker, userId, event, run } = bus;
  const numeric = 1700000000 + Math.floor(Math.random() * 100000000);
  const campuses = [0, 1].map((index) => ({
    id: numeric + index,
    name: `private-campus-${marker}-${index}`,
    latitude: 31.8 + index / 100,
    longitude: 117.2 + index / 100,
  }));
  const route = { id: numeric, campuses };
  const payload: BusStaticPayload = {
    campuses,
    routes: [route],
    weekday_routes: [{ id: 1, route, time: [["08:00", "08:30"]] }],
    saturday_routes: [],
    sunday_routes: [],
    message: {
      message: `2099冬 private-source-${marker}`,
      url: `https://private-source.example/${marker}`,
    },
  };
  const originalFetch = globalThis.fetch;
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      if (String(input) === getBusDataUrl()) return Response.json(payload);
      return originalFetch(input, init);
    });
  try {
    expect(
      await run(() => adminBusActions.importStatic(event())),
    ).toMatchObject({
      variant: "default",
    });
    const version = await db.busScheduleVersion.findUniqueOrThrow({
      where: { key: "static-bus-2099-冬" },
    });
    expect(await db.busTrip.count({ where: { versionId: version.id } })).toBe(
      1,
    );
    expect(
      await db.busCampus.count({
        where: { id: { in: campuses.map((row) => row.id) } },
      }),
    ).toBe(2);
    expect(await db.busRoute.count({ where: { id: numeric } })).toBe(1);
    const rows = await db.auditLog.findMany({
      where: {
        userId,
        action: "admin_bus_import",
        targetId: String(version.id),
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId,
      channel: "web",
      targetType: "bus_schedule_version",
      metadata: { campuses: 2, routes: 1, trips: 1 },
    });
    for (const secret of [
      campuses[0].name,
      campuses[1].name,
      payload.message?.message,
      payload.message?.url,
      "08:00",
      "08:30",
    ])
      if (secret) expect(JSON.stringify(rows)).not.toContain(secret);
  } finally {
    fetch.mockRestore();
  }
});
