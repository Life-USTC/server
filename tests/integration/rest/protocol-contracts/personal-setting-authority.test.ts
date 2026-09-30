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

for (const transport of transports) {
  test(`bus preferences successful updates preserve ownership through ${transport}`, async ({
    run,
    h,
  }) => {
    await run(async () => {
      for (const actor of h.actors) {
        const foreign = (await busSnapshot(h)).filter(
          (row) => row.userId !== actor.id,
        );
        for (const departed of [true, false]) {
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
          expect(
            await h.db.busUserPreference.findUnique({
              where: { userId: actor.id },
            }),
          ).toMatchObject(expected);
          expect(
            (await busSnapshot(h)).filter((row) => row.userId !== actor.id),
          ).toEqual(foreign);
        }
      }
    });
  });

  test(`bus preferences authorization rejection preserves state through ${transport}`, async ({
    run,
    h,
  }) => {
    await run(async () => {
      await h.db.busUserPreference.createMany({
        data: h.actors.map((actor) => ({
          userId: actor.id,
          preferredOriginCampusId: null,
          preferredDestinationCampusId: null,
          showDepartedTrips: false,
        })),
      });
      const before = await busSnapshot(h);
      for (const outcome of ["anonymous", "read_scope"] as const) {
        await call(
          h,
          transport,
          busPreference(null, null, true),
          h.actors[0],
          outcome,
        );
        expect(await busSnapshot(h)).toEqual(before);
      }
    });
  });

  test(`bus preferences invalid input preserves state through ${transport}`, async ({
    run,
    h,
  }) => {
    await run(async () => {
      await h.db.busUserPreference.createMany({
        data: h.actors.map((actor) => ({
          userId: actor.id,
          preferredOriginCampusId: null,
          preferredDestinationCampusId: null,
          showDepartedTrips: false,
        })),
      });
      const before = await busSnapshot(h);
      for (const [origin, destination] of [
        [2147483647, null],
        [null, 2147483647],
      ]) {
        await call(
          h,
          transport,
          busPreference(origin, destination, true),
          h.actors[0],
          "invalid_bus_preference",
        );
        expect(await busSnapshot(h)).toEqual(before);
      }
    });
  });

  test(`bus preferences suspended updates preserve ownership through ${transport}`, async ({
    run,
    h,
  }) => {
    await run(async () => {
      await h.db.busUserPreference.createMany({
        data: h.actors.map((actor) => ({
          userId: actor.id,
          preferredOriginCampusId: null,
          preferredDestinationCampusId: null,
          showDepartedTrips: false,
        })),
      });
      await h.db.userSuspension.create({
        data: { userId: h.actors[0].id, reason: h.marker },
      });
      const before = await busSnapshot(h);
      for (const departed of [true, false]) {
        const expected = {
          preferredOriginCampusId: null,
          preferredDestinationCampusId: null,
          showDepartedTrips: departed,
        };
        const result = await call(
          h,
          transport,
          busPreference(null, null, departed),
          h.actors[0],
        );
        expect(transport === "graphql" ? result : result.preference).toEqual(
          expected,
        );
        expect(
          await h.db.busUserPreference.findUnique({
            where: { userId: h.actors[0].id },
          }),
        ).toMatchObject(expected);
        expect(
          (await busSnapshot(h)).filter((row) => row.userId !== h.actors[0].id),
        ).toEqual(before.filter((row) => row.userId !== h.actors[0].id));
      }
    });
  });
}

for (const transport of transports) {
  test(`link pins successful updates preserve ownership through ${transport}`, async ({
    run,
    h,
  }) => {
    await run(async () => {
      await h.db.workspaceLinkPin.createMany({
        data: h.actors.map((actor) => ({ userId: actor.id, slug: "jw" })),
      });
      for (const actor of h.actors) {
        const foreign = (await pinSnapshot(h)).filter(
          (row) => row.userId !== actor.id,
        );
        for (const pinned of [true, false]) {
          const expected = pinned ? ["jw", "mail"] : ["jw"];
          const result = await call(
            h,
            transport,
            linkPin("mail", pinned),
            actor,
          );
          expect(result.pinnedSlugs).toEqual(expected);
          expect(
            (await pinSnapshot(h))
              .filter((row) => row.userId === actor.id)
              .map((row) => row.slug),
          ).toEqual(expected);
          expect(
            (await pinSnapshot(h)).filter((row) => row.userId !== actor.id),
          ).toEqual(foreign);
        }
      }
    });
  });

  test(`link pins authorization rejection preserves state through ${transport}`, async ({
    run,
    h,
  }) => {
    await run(async () => {
      await h.db.workspaceLinkPin.createMany({
        data: h.actors.map((actor) => ({ userId: actor.id, slug: "jw" })),
      });
      const before = await pinSnapshot(h);
      for (const outcome of ["anonymous", "read_scope"] as const) {
        await call(h, transport, linkPin("mail", true), h.actors[0], outcome);
        expect(await pinSnapshot(h)).toEqual(before);
      }
    });
  });

  test(`link pins invalid input preserves state through ${transport}`, async ({
    run,
    h,
  }) => {
    await run(async () => {
      await h.db.workspaceLinkPin.createMany({
        data: h.actors.map((actor) => ({ userId: actor.id, slug: "jw" })),
      });
      const before = await pinSnapshot(h);
      for (const pinned of [true, false]) {
        const result = await call(
          h,
          transport,
          linkPin("unknown-test-link", pinned),
          h.actors[0],
          "invalid_slug",
        );
        if (transport !== "graphql") expect(result.pinnedSlugs).toEqual(["jw"]);
        expect(await pinSnapshot(h)).toEqual(before);
      }
    });
  });

  test(`link pins suspended updates preserve ownership through ${transport}`, async ({
    run,
    h,
  }) => {
    await run(async () => {
      await h.db.workspaceLinkPin.createMany({
        data: h.actors.map((actor) => ({ userId: actor.id, slug: "jw" })),
      });
      await h.db.userSuspension.create({
        data: { userId: h.actors[0].id, reason: h.marker },
      });
      const before = await pinSnapshot(h);
      for (const pinned of [true, false]) {
        const result = await call(
          h,
          transport,
          linkPin("mail", pinned),
          h.actors[0],
        );
        expect(result.pinnedSlugs).toEqual(pinned ? ["jw", "mail"] : ["jw"]);
        expect(
          (await pinSnapshot(h))
            .filter((row) => row.userId === h.actors[0].id)
            .map((row) => row.slug),
        ).toEqual(pinned ? ["jw", "mail"] : ["jw"]);
        expect(
          (await pinSnapshot(h)).filter((row) => row.userId !== h.actors[0].id),
        ).toEqual(before.filter((row) => row.userId !== h.actors[0].id));
      }
      expect(await pinSnapshot(h)).toEqual(before);
    });
  });
}
