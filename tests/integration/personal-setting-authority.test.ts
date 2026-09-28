import { isDeepStrictEqual } from "node:util";
import { expect, it } from "vitest";
import { busPreference, linkPin } from "../shared/personal-state-write-parity";
import {
  type SemanticContract,
  semanticContract,
} from "../shared/specifications/semantic-contract";
import {
  createWriteTransportHarness,
  transports,
} from "../shared/write-transport-harness";

function authorityCall(
  contract: SemanticContract,
  h: Awaited<ReturnType<typeof createWriteTransportHarness>>,
) {
  return async (...args: Parameters<typeof h.call>) => {
    const result = await h.call(...args);
    const response = h.responses.at(-1);
    if (!response) throw new Error("Missing actual transport observation");
    const { transport, operation, allowed } = response;
    contract.equal(
      `/operations/${transport}`,
      transport === "rest"
        ? `${operation.rest.method} ${operation.rest.path}`
        : transport === "graphql"
          ? operation.graphql.field
          : operation.mcp.name,
    );
    const outcome = args[3];
    if (outcome === "anonymous" || outcome === "read_scope")
      contract.equal(`/${outcome}_rejected`, !allowed);
    if (outcome === "invalid_slug" || outcome === "invalid_bus_preference")
      contract.equal("/invalid_target_rejected", !allowed);
    if (await h.db.userSuspension.count({ where: { userId: args[2].id } }))
      contract.equal("/suspended_owner_allowed", allowed);
    return result;
  };
}

it("bus.preference-owner-state", async (context) => {
  const contract = await semanticContract(
    "bus.preference-owner-state",
    "private_setting_authority",
  );
  const h = await createWriteTransportHarness(["workspace.bus-preferences"]);
  const call = authorityCall(contract, h);
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
          const result = await call(
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
          contract.equal(
            "/owner_changes_only",
            isDeepStrictEqual(
              (await snapshot()).filter((row) => row.userId === other?.id),
              foreignBefore,
            ),
          );
          const stored = await h.db.busUserPreference.findUniqueOrThrow({
            where: { userId: actor.id },
          });
          contract.equal(
            "/response_matches_state",
            isDeepStrictEqual(
              transport === "graphql" ? result : result.preference,
              {
                preferredOriginCampusId: stored.preferredOriginCampusId,
                preferredDestinationCampusId:
                  stored.preferredDestinationCampusId,
                showDepartedTrips: stored.showDepartedTrips,
              },
            ),
          );
        }
      }
    const before = await snapshot();
    for (const transport of transports) {
      for (const outcome of ["anonymous", "read_scope"] as const)
        await call(
          transport,
          busPreference(null, null, true),
          h.actors[0],
          outcome,
        );
      await call(
        transport,
        busPreference(2147483647, null, true),
        h.actors[0],
        "invalid_bus_preference",
      );
      await call(
        transport,
        busPreference(null, 2147483647, true),
        h.actors[0],
        "invalid_bus_preference",
      );
    }
    contract.equal(
      "/denied_state_unchanged",
      isDeepStrictEqual(await snapshot(), before),
    );
    await h.db.userSuspension.create({
      data: { userId: h.actors[0].id, reason: h.fixture.marker },
    });
    for (const transport of transports) {
      await call(transport, busPreference(null, null, true), h.actors[0]);
      await call(transport, busPreference(null, null, false), h.actors[0]);
    }
    expect(
      (await snapshot()).find((row) => row.userId === h.actors[1].id),
    ).toEqual(before.find((row) => row.userId === h.actors[1].id));
    contract.recordVitest(context);
  } finally {
    await h.cleanup();
  }
});

it("catalog-link.pin-owner-state", async (context) => {
  const contract = await semanticContract(
    "catalog-link.pin-owner-state",
    "private_setting_authority",
  );
  const h = await createWriteTransportHarness(["workspace.link-pin"]);
  const call = authorityCall(contract, h);
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
          const result = await call(transport, linkPin("mail", pinned), actor);
          expect(result.pinnedSlugs).toEqual(pinned ? ["jw", "mail"] : ["jw"]);
          expect(
            (await snapshot())
              .filter((row) => row.userId === actor.id)
              .map((row) => row.slug),
          ).toEqual(result.pinnedSlugs);
          contract.equal(
            "/owner_changes_only",
            isDeepStrictEqual(
              (await snapshot()).filter((row) => row.userId !== actor.id),
              foreignBefore,
            ),
          );
          contract.equal(
            "/response_matches_state",
            isDeepStrictEqual(
              (await snapshot())
                .filter((row) => row.userId === actor.id)
                .map((row) => row.slug),
              result.pinnedSlugs,
            ),
          );
        }
      }
    const before = await snapshot();
    for (const transport of transports) {
      for (const outcome of ["anonymous", "read_scope"] as const)
        await call(transport, linkPin("mail", true), h.actors[0], outcome);
      for (const pinned of [true, false]) {
        const result = await call(
          transport,
          linkPin("unknown-test-link", pinned),
          h.actors[0],
          "invalid_slug",
        );
        if (transport !== "graphql") expect(result.pinnedSlugs).toEqual(["jw"]);
      }
    }
    contract.equal(
      "/denied_state_unchanged",
      isDeepStrictEqual(await snapshot(), before),
    );
    await h.db.userSuspension.create({
      data: { userId: h.actors[0].id, reason: h.fixture.marker },
    });
    for (const transport of transports) {
      await call(transport, linkPin("mail", true), h.actors[0]);
      await call(transport, linkPin("mail", false), h.actors[0]);
    }
    expect(await snapshot()).toEqual(before);
    contract.recordVitest(context);
  } finally {
    await h.cleanup();
  }
});
