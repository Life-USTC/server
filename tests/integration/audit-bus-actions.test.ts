import type { RequestEvent } from "@sveltejs/kit";
import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { adminBusActions } from "@/features/admin/server/admin-bus-page-server";
import { getBusDataUrl } from "@/features/bus/lib/bus-static-source";
import type { BusStaticPayload } from "@/features/bus/lib/bus-types";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const origin = "http://localhost:3000";
let userId: string;
let cookie: string;
const versions: number[] = [];
let originalEnabled: number[] = [];
beforeAll(async () => {
  userId = (
    await db.user.create({
      data: { email: `bus-audit-${marker}@example.test`, isAdmin: true },
    })
  ).id;
  const token = crypto.randomUUID();
  await db.session.create({
    data: {
      userId,
      sessionToken: token,
      expires: new Date(Date.now() + 3600000),
    },
  });
  const context = await getBetterAuthInstance().$context;
  cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`;
  originalEnabled = (
    await db.busScheduleVersion.findMany({
      where: { isEnabled: true },
      select: { id: true },
    })
  ).map((row) => row.id);
});
afterAll(async () => {
  await db.auditLog.deleteMany({ where: { userId } });
  await db.busScheduleVersion.deleteMany({ where: { id: { in: versions } } });
  await db.busScheduleVersion.updateMany({
    where: { id: { in: originalEnabled } },
    data: { isEnabled: true },
  });
  await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});
function event(id?: number, requestId = "bus-audit-request") {
  const body = new FormData();
  if (id) body.set("id", String(id));
  return {
    locals: { locale: "en-us", requestId } as RequestEvent["locals"],
    request: new Request(`${origin}/admin/bus`, {
      method: "POST",
      headers: { cookie, origin },
      body,
    }),
  };
}
it("audit.action-admin-bus-version-activate", async () => {
  const version = await db.busScheduleVersion.create({
    data: {
      key: `bus-audit-${marker}`,
      checksum: marker,
      rawJson: {},
      title: `private title ${marker}`,
      isEnabled: false,
    },
  });
  versions.push(version.id);
  const before = await db.busScheduleVersion.findMany({
    orderBy: { id: "asc" },
  });
  await expect(
    adminBusActions.activateVersion(
      event(version.id, "invalid\u0000audit-request"),
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
    await adminBusActions.activateVersion(event(version.id)),
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
it("audit.action-admin-bus-import", async () => {
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
    expect(await adminBusActions.importStatic(event())).toMatchObject({
      variant: "default",
    });
    const version = await db.busScheduleVersion.findUniqueOrThrow({
      where: { key: "static-bus-2099-冬" },
    });
    versions.push(version.id);
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
    await db.busTrip.deleteMany({ where: { routeId: numeric } });
    await db.busRouteStop.deleteMany({ where: { routeId: numeric } });
    await db.busRoute.deleteMany({ where: { id: numeric } });
    await db.busCampus.deleteMany({
      where: { id: { in: campuses.map((row) => row.id) } },
    });
  }
});
