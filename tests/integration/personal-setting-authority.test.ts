import { expect, it } from "vitest";
import { busPreference, linkPin } from "../shared/personal-state-write-parity";
import {
  createWriteTransportHarness,
  transports,
} from "../shared/write-transport-harness";

it("bus.preference-owner-state", async () => {
  const h = await createWriteTransportHarness(["workspace.bus-preferences"]);
  try {
    const snapshot = () =>
      h.db.busUserPreference.findMany({
        where: { userId: { in: h.actors.map((a) => a.id) } },
        orderBy: { userId: "asc" },
      });
    for (const transport of transports)
      for (const actor of h.actors) {
        const other = h.actors.find((a) => a.id !== actor.id);
        const foreignBefore = (await snapshot()).filter(
          (row) => row.userId === other?.id,
        );
        for (const departed of [true, false]) {
          const result = await h.call(
            transport,
            busPreference(null, null, departed),
            actor,
          );
          expect(transport === "graphql" ? result : result.preference).toEqual({
            preferredOriginCampusId: null,
            preferredDestinationCampusId: null,
            showDepartedTrips: departed,
          });
          expect(
            await h.db.busUserPreference.findUnique({
              where: { userId: actor.id },
            }),
          ).toMatchObject({
            preferredOriginCampusId: null,
            preferredDestinationCampusId: null,
            showDepartedTrips: departed,
          });
          expect(
            (await snapshot()).filter((row) => row.userId === other?.id),
          ).toEqual(foreignBefore);
        }
      }
    const before = await snapshot();
    for (const transport of transports) {
      for (const outcome of ["anonymous", "read_scope"] as const)
        await h.call(
          transport,
          busPreference(null, null, true),
          h.actors[0],
          outcome,
        );
      await h.call(
        transport,
        busPreference(2147483647, null, true),
        h.actors[0],
        "invalid_bus_preference",
      );
      await h.call(
        transport,
        busPreference(null, 2147483647, true),
        h.actors[0],
        "invalid_bus_preference",
      );
    }
    expect(await snapshot()).toEqual(before);
    await h.db.userSuspension.create({
      data: { userId: h.actors[0].id, reason: h.fixture.marker },
    });
    for (const transport of transports) {
      await h.call(transport, busPreference(null, null, true), h.actors[0]);
      await h.call(transport, busPreference(null, null, false), h.actors[0]);
    }
    expect(
      (await snapshot()).find((row) => row.userId === h.actors[1].id),
    ).toEqual(before.find((row) => row.userId === h.actors[1].id));
  } finally {
    await h.cleanup();
  }
});

it("catalog-link.pin-owner-state", async () => {
  const h = await createWriteTransportHarness(["workspace.link-pin"]);
  try {
    const snapshot = () =>
      h.db.workspaceLinkPin.findMany({
        where: { userId: { in: h.actors.map((a) => a.id) } },
        orderBy: [{ userId: "asc" }, { createdAt: "asc" }, { slug: "asc" }],
      });
    for (const actor of h.actors)
      await h.db.workspaceLinkPin.create({
        data: { userId: actor.id, slug: "jw" },
      });
    for (const transport of transports)
      for (const actor of h.actors) {
        const foreignBefore = (await snapshot()).filter(
          (row) => row.userId !== actor.id,
        );
        for (const pinned of [true, false]) {
          const result = await h.call(
            transport,
            linkPin("mail", pinned),
            actor,
          );
          expect(result.pinnedSlugs).toEqual(pinned ? ["jw", "mail"] : ["jw"]);
          expect(
            (await snapshot())
              .filter((row) => row.userId === actor.id)
              .map((row) => row.slug),
          ).toEqual(result.pinnedSlugs);
          expect(
            (await snapshot()).filter((row) => row.userId !== actor.id),
          ).toEqual(foreignBefore);
        }
      }
    const before = await snapshot();
    for (const transport of transports) {
      for (const outcome of ["anonymous", "read_scope"] as const)
        await h.call(transport, linkPin("mail", true), h.actors[0], outcome);
      for (const pinned of [true, false]) {
        const result = await h.call(
          transport,
          linkPin("unknown-test-link", pinned),
          h.actors[0],
          "invalid_slug",
        );
        if (transport !== "graphql") expect(result.pinnedSlugs).toEqual(["jw"]);
      }
    }
    expect(await snapshot()).toEqual(before);
    await h.db.userSuspension.create({
      data: { userId: h.actors[0].id, reason: h.fixture.marker },
    });
    for (const transport of transports) {
      await h.call(transport, linkPin("mail", true), h.actors[0]);
      await h.call(transport, linkPin("mail", false), h.actors[0]);
    }
    expect(await snapshot()).toEqual(before);
  } finally {
    await h.cleanup();
  }
});
