import { expect } from "@playwright/test";
import { type Actor, type ProtocolFixture, test } from "./_fixture";
import {
  nativeEnvelope,
  type Operation,
  sendOperation,
  type Transport,
  transports,
} from "./_transport";

type Outcome =
  | "success"
  | "anonymous"
  | "read_scope"
  | "invalid_slug"
  | "invalid_bus_preference";
test.use({ features: ["workspace.bus-preferences", "workspace.link-pin"] });
function busPreference(
  origin: number | null,
  destination: number | null,
  departed: boolean,
): Operation {
  const input = {
    preferredOriginCampusId: origin,
    preferredDestinationCampusId: destination,
    showDepartedTrips: departed,
  };
  return {
    rest: {
      path: "/api/workspace/bus-preferences",
      method: "POST",
      body: input,
    },
    graphql: {
      field: "busPreferencesSet",
      query:
        "mutation($input: BusPreferenceInput!) { busPreferencesSet(input:$input) { preferredOriginCampusId preferredDestinationCampusId showDepartedTrips } }",
      variables: { input },
    },
    mcp: { name: "workspace_bus_preferences_set", arguments: input },
  };
}
function linkPin(slug: string, pinned: boolean): Operation {
  return {
    rest: {
      path: "/api/workspace/link-pins",
      method: "POST",
      form: {
        slug,
        action: pinned ? "pin" : "unpin",
        returnTo: "/catalog/links",
      },
    },
    graphql: {
      field: "linkPinSet",
      query:
        "mutation($slug:String!, $pinned:Boolean!) { linkPinSet(slug:$slug,pinned:$pinned) { pinnedSlugs } }",
      variables: { slug, pinned },
    },
    mcp: {
      name: "workspace_link_pin_set",
      arguments: { slug, action: pinned ? "pin" : "unpin" },
    },
  };
}
async function call(
  h: ProtocolFixture,
  transport: Transport,
  operation: Operation,
  actor: Actor,
  expected: Outcome = "success",
) {
  const token =
    expected === "read_scope"
      ? actor.readTokens[transport]
      : actor.tokens[transport];
  const response = await sendOperation(
    h.origin,
    transport,
    operation,
    expected === "anonymous" ? undefined : token,
  );
  const text = await response.clone().text();
  const payload = await nativeEnvelope(response);
  if (expected === "anonymous" || expected === "read_scope") {
    expect(response.status, text).toBe(
      expected === "anonymous" || transport === "rest" ? 401 : 403,
    );
    if (transport === "graphql")
      expect(payload.errors[0].extensions.code).toBe(
        expected === "anonymous" ? "UNAUTHENTICATED" : "FORBIDDEN",
      );
    if (transport === "mcp") expect(payload.error).toBeDefined();
    return {};
  }
  const invalid =
    expected === "invalid_slug" || expected === "invalid_bus_preference";

  if (transport === "mcp") {
    expect(response.status, text).toBe(200);
    expect(payload.error, text).toBeUndefined();
    expect(payload.result.isError, text).not.toBe(true);
    const content = JSON.parse(
      payload.result.content.find(
        (part: { type: string }) => part.type === "text",
      ).text,
    );
    expect(content.success, text).toBe(expected === "success");
    if (expected !== "success") expect(content.error, text).toBe(expected);
    return content;
  }
  if (expected !== "success") {
    expect(response.status, text).toBe(invalid ? 400 : 403);
    if (transport === "graphql")
      expect(payload.errors[0].extensions.code).toBe(
        invalid ? "BAD_USER_INPUT" : "FORBIDDEN",
      );
    else expect(payload.error).toEqual(expect.any(String));
    return payload;
  }
  expect([200, 201], text).toContain(response.status);
  if (transport === "graphql") {
    expect(payload.errors, text).toBeUndefined();
    return payload.data[operation.graphql.field];
  }
  return payload;
}
function busSnapshot(h: ProtocolFixture) {
  return h.db.busUserPreference.findMany({
    where: { userId: { in: h.actors.map((actor) => actor.id) } },
    orderBy: { userId: "asc" },
  });
}
function pinSnapshot(h: ProtocolFixture) {
  return h.db.workspaceLinkPin.findMany({
    where: { userId: { in: h.actors.map((actor) => actor.id) } },
    orderBy: [{ userId: "asc" }, { createdAt: "asc" }, { slug: "asc" }],
  });
}

const seededAt = new Date("2025-01-01T00:00:00.000Z");
const seededMailAt = new Date("2025-01-02T00:00:00.000Z");

async function seedBusPreferences(
  h: ProtocolFixture,
  actor: Actor,
  initial: boolean | null,
  suspended = false,
) {
  await h.db.$transaction([
    h.db.busUserPreference.createMany({
      data: h.actors
        .filter((owner) => owner.id !== actor.id || initial !== null)
        .map((owner) => ({
          userId: owner.id,
          preferredOriginCampusId: null,
          preferredDestinationCampusId: null,
          showDepartedTrips: owner.id === actor.id && initial === true,
          createdAt: seededAt,
          updatedAt: seededAt,
        })),
    }),
    ...(suspended
      ? [
          h.db.userSuspension.create({
            data: { userId: actor.id, reason: h.marker },
          }),
        ]
      : []),
  ]);
}

async function seedLinkPins(
  h: ProtocolFixture,
  actor: Actor,
  initiallyPinned: boolean,
  suspended = false,
) {
  await h.db.$transaction([
    h.db.workspaceLinkPin.createMany({
      data: h.actors.flatMap((owner) =>
        (owner.id !== actor.id || initiallyPinned
          ? ["jw", "mail"]
          : ["jw"]
        ).map((slug) => ({
          userId: owner.id,
          slug,
          createdAt: slug === "jw" ? seededAt : seededMailAt,
          updatedAt: slug === "jw" ? seededAt : seededMailAt,
        })),
      ),
    }),
    ...(suspended
      ? [
          h.db.userSuspension.create({
            data: { userId: actor.id, reason: h.marker },
          }),
        ]
      : []),
  ]);
}

for (const transport of transports) {
  for (const [operation, initial, departed, actorIndex, suspended] of [
    ["create", null, true, 0, false],
    ["enable", false, true, 1, false],
    ["disable", true, false, 0, false],
    ["repeat enabled", true, true, 0, false],
    ["repeat disabled", false, false, 1, false],
    ["suspended enable", false, true, 0, true],
    ["suspended disable", true, false, 0, true],
  ] as const) {
    test(`bus preferences ${operation} preserves ownership through ${transport}`, {
      tag: `@Bus/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
    }, async ({ run, h }) => {
      await run(async () => {
        const actor = h.actors[actorIndex];
        await seedBusPreferences(h, actor, initial, suspended);
        const before = await busSnapshot(h);
        const expected = {
          preferredOriginCampusId: null,
          preferredDestinationCampusId: null,
          showDepartedTrips: departed,
        };
        const result = await call(
          h,
          transport,
          busPreference(null, null, departed),
          actor,
        );
        expect(transport === "graphql" ? result : result.preference).toEqual(
          expected,
        );
        const after = await busSnapshot(h);
        expect(after).toHaveLength(before.length + (initial === null ? 1 : 0));
        expect(after.filter((row) => row.userId !== actor.id)).toEqual(
          before.filter((row) => row.userId !== actor.id),
        );
        const saved = after.find((row) => row.userId === actor.id);
        expect(saved).toEqual({
          userId: actor.id,
          ...expected,
          createdAt: initial === null ? expect.any(Date) : seededAt,
          updatedAt: expect.any(Date),
        });
        expect(saved?.updatedAt.getTime()).toBeGreaterThan(seededAt.getTime());
      });
    });
  }

  for (const outcome of ["anonymous", "read_scope"] as const) {
    test(`bus preferences ${outcome} rejection preserves state through ${transport}`, {
      tag: `@Bus/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
    }, async ({ run, h }) => {
      await run(async () => {
        await seedBusPreferences(h, h.actors[0], false);
        const before = await busSnapshot(h);
        await call(
          h,
          transport,
          busPreference(null, null, true),
          h.actors[0],
          outcome,
        );
        expect(await busSnapshot(h)).toEqual(before);
      });
    });
  }

  for (const [field, origin, destination] of [
    ["origin", 2147483647, null],
    ["destination", null, 2147483647],
  ] as const) {
    test(`bus preferences invalid ${field} preserves state through ${transport}`, {
      tag: `@Bus/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
    }, async ({ run, h }) => {
      await run(async () => {
        await seedBusPreferences(h, h.actors[0], false);
        const before = await busSnapshot(h);
        await call(
          h,
          transport,
          busPreference(origin, destination, true),
          h.actors[0],
          "invalid_bus_preference",
        );
        expect(await busSnapshot(h)).toEqual(before);
      });
    });
  }
}

for (const transport of transports) {
  for (const [operation, initial, pinned, actorIndex, suspended] of [
    ["pin", false, true, 0, false],
    ["unpin", true, false, 1, false],
    ["repeat pin", true, true, 0, false],
    ["repeat unpin", false, false, 1, false],
    ["suspended pin", false, true, 0, true],
    ["suspended unpin", true, false, 0, true],
  ] as const) {
    test(`link pins ${operation} preserves ownership through ${transport}`, {
      tag: `@CatalogLink/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
    }, async ({ run, h }) => {
      await run(async () => {
        const actor = h.actors[actorIndex];
        await seedLinkPins(h, actor, initial, suspended);
        const before = await pinSnapshot(h);
        const expected = pinned ? ["jw", "mail"] : ["jw"];
        const result = await call(h, transport, linkPin("mail", pinned), actor);
        expect(result.pinnedSlugs).toEqual(expected);
        const after = await pinSnapshot(h);
        expect(
          after.filter((row) => row.userId === actor.id).map((row) => row.slug),
        ).toEqual(expected);
        expect(after.filter((row) => row.userId !== actor.id)).toEqual(
          before.filter((row) => row.userId !== actor.id),
        );
        const preserved = before.filter(
          (row) => row.userId !== actor.id || row.slug !== "mail" || pinned,
        );
        expect(
          after.filter((row) => preserved.some((old) => old.id === row.id)),
        ).toEqual(preserved);
        if (pinned && !initial) {
          const added = after.find(
            (row) => row.userId === actor.id && row.slug === "mail",
          );
          expect(added).toEqual({
            id: expect.any(String),
            userId: actor.id,
            slug: "mail",
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          });
          expect(added?.createdAt.getTime()).toBeGreaterThan(
            seededMailAt.getTime(),
          );
          expect(added?.updatedAt.getTime()).toBeGreaterThan(
            seededMailAt.getTime(),
          );
          expect(after).toHaveLength(before.length + 1);
        } else {
          expect(after).toEqual(preserved);
        }
      });
    });
  }

  for (const outcome of ["anonymous", "read_scope"] as const) {
    test(`link pins ${outcome} rejection preserves state through ${transport}`, {
      tag: `@CatalogLink/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
    }, async ({ run, h }) => {
      await run(async () => {
        await seedLinkPins(h, h.actors[0], false);
        const before = await pinSnapshot(h);
        await call(h, transport, linkPin("mail", true), h.actors[0], outcome);
        expect(await pinSnapshot(h)).toEqual(before);
      });
    });
  }

  for (const pinned of [true, false]) {
    test(`link pins invalid ${pinned ? "pin" : "unpin"} preserves state through ${transport}`, {
      tag: `@CatalogLink/${transport === "graphql" ? "GraphQL" : transport.toUpperCase()}`,
    }, async ({ run, h }) => {
      await run(async () => {
        await seedLinkPins(h, h.actors[0], false);
        const before = await pinSnapshot(h);
        const result = await call(
          h,
          transport,
          linkPin("unknown-test-link", pinned),
          h.actors[0],
          "invalid_slug",
        );
        if (transport !== "graphql") expect(result.pinnedSlugs).toEqual(["jw"]);
        expect(await pinSnapshot(h)).toEqual(before);
      });
    });
  }
}
