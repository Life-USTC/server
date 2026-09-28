import { expect, it } from "vitest";
import { busPreference, linkPin } from "../shared/personal-state-write-parity";
import {
  createWriteTransportHarness,
  transports,
} from "../shared/write-transport-harness";

it.each(transports)(
  "bus preferences preserve ownership through %s",
  async (transport) => {
    const h = await createWriteTransportHarness(["workspace.bus-preferences"]);
    try {
      const snapshot = () =>
        h.db.busUserPreference.findMany({
          where: { userId: { in: h.actors.map((actor) => actor.id) } },
          orderBy: { userId: "asc" },
        });
      for (const actor of h.actors) {
        const foreign = (await snapshot()).filter(
          (row) => row.userId !== actor.id,
        );
        for (const departed of [true, false]) {
          const expected = {
            preferredOriginCampusId: null,
            preferredDestinationCampusId: null,
            showDepartedTrips: departed,
          };
          const result = await h.call(
            transport,
            busPreference(null, null, departed),
            actor,
          );
          expect(transport === "graphql" ? result : result.preference).toEqual(
            expected,
          );
          expect(
            await h.db.busUserPreference.findUnique({
              where: { userId: actor.id },
            }),
          ).toMatchObject(expected);
          expect(
            (await snapshot()).filter((row) => row.userId !== actor.id),
          ).toEqual(foreign);
        }
      }
      const before = await snapshot();
      for (const outcome of ["anonymous", "read_scope"] as const) {
        await h.call(
          transport,
          busPreference(null, null, true),
          h.actors[0],
          outcome,
        );
        expect(await snapshot()).toEqual(before);
      }
      for (const [origin, destination] of [
        [2147483647, null],
        [null, 2147483647],
      ]) {
        await h.call(
          transport,
          busPreference(origin, destination, true),
          h.actors[0],
          "invalid_bus_preference",
        );
        expect(await snapshot()).toEqual(before);
      }
      await h.db.userSuspension.create({
        data: { userId: h.actors[0].id, reason: h.fixture.marker },
      });
      for (const departed of [true, false]) {
        await h.call(
          transport,
          busPreference(null, null, departed),
          h.actors[0],
        );
        expect(
          await h.db.busUserPreference.findUnique({
            where: { userId: h.actors[0].id },
          }),
        ).toMatchObject({ showDepartedTrips: departed });
        expect(
          (await snapshot()).filter((row) => row.userId !== h.actors[0].id),
        ).toEqual(before.filter((row) => row.userId !== h.actors[0].id));
      }
    } finally {
      await h.cleanup();
    }
  },
);

it.each(transports)(
  "link pins preserve ownership through %s",
  async (transport) => {
    const h = await createWriteTransportHarness(["workspace.link-pin"]);
    try {
      const snapshot = () =>
        h.db.workspaceLinkPin.findMany({
          where: { userId: { in: h.actors.map((actor) => actor.id) } },
          orderBy: [{ userId: "asc" }, { createdAt: "asc" }, { slug: "asc" }],
        });
      await h.db.workspaceLinkPin.createMany({
        data: h.actors.map((actor) => ({ userId: actor.id, slug: "jw" })),
      });
      for (const actor of h.actors) {
        const foreign = (await snapshot()).filter(
          (row) => row.userId !== actor.id,
        );
        for (const pinned of [true, false]) {
          const expected = pinned ? ["jw", "mail"] : ["jw"];
          const result = await h.call(
            transport,
            linkPin("mail", pinned),
            actor,
          );
          expect(result.pinnedSlugs).toEqual(expected);
          expect(
            (await snapshot())
              .filter((row) => row.userId === actor.id)
              .map((row) => row.slug),
          ).toEqual(expected);
          expect(
            (await snapshot()).filter((row) => row.userId !== actor.id),
          ).toEqual(foreign);
        }
      }
      const before = await snapshot();
      for (const outcome of ["anonymous", "read_scope"] as const) {
        await h.call(transport, linkPin("mail", true), h.actors[0], outcome);
        expect(await snapshot()).toEqual(before);
      }
      for (const pinned of [true, false]) {
        const result = await h.call(
          transport,
          linkPin("unknown-test-link", pinned),
          h.actors[0],
          "invalid_slug",
        );
        if (transport !== "graphql") expect(result.pinnedSlugs).toEqual(["jw"]);
        expect(await snapshot()).toEqual(before);
      }
      await h.db.userSuspension.create({
        data: { userId: h.actors[0].id, reason: h.fixture.marker },
      });
      for (const pinned of [true, false]) {
        const result = await h.call(
          transport,
          linkPin("mail", pinned),
          h.actors[0],
        );
        expect(result.pinnedSlugs).toEqual(pinned ? ["jw", "mail"] : ["jw"]);
        expect(
          (await snapshot())
            .filter((row) => row.userId === h.actors[0].id)
            .map((row) => row.slug),
        ).toEqual(pinned ? ["jw", "mail"] : ["jw"]);
        expect(
          (await snapshot()).filter((row) => row.userId !== h.actors[0].id),
        ).toEqual(before.filter((row) => row.userId !== h.actors[0].id));
      }
      expect(await snapshot()).toEqual(before);
    } finally {
      await h.cleanup();
    }
  },
);
