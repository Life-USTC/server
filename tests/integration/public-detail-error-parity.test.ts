import { expect, it } from "vitest";
import { createWriteTransportHarness } from "../shared/write-transport-harness";

it("interface-hierarchy.public-detail-not-found-parity", async () => {
  const h = await createWriteTransportHarness(["community.user"]);
  const youngId = `${h.fixture.marker}-event`;
  const organizerId = `${h.fixture.marker}-organizer`;
  try {
    await h.db.youngOrganizer.create({
      data: { id: organizerId, name: organizerId, normalizedName: organizerId },
    });
    await h.db.youngEvent.create({
      data: {
        youngId,
        name: youngId,
        organizerId,
        rawJson: {},
        isActive: true,
      },
    });
    const missingId = `${h.fixture.marker}-missing`;
    const missingNumber = h.fixture.base + 99;
    const cases = [
      {
        rest: "catalog/courses",
        root: "catalog",
        field: "course",
        key: "jwId",
        type: "Int!",
        tool: "catalog_course_get",
        present: h.fixture.courses[0].jwId,
        missing: missingNumber,
      },
      {
        rest: "catalog/sections",
        root: "catalog",
        field: "section",
        key: "jwId",
        type: "Int!",
        tool: "catalog_section_get",
        present: h.section.jwId,
        missing: missingNumber,
      },
      {
        rest: "catalog/teachers",
        root: "catalog",
        field: "teacher",
        key: "id",
        type: "Int!",
        tool: "catalog_teacher_get",
        present: h.fixture.teachers[0].id,
        missing: 2147483647,
      },
      {
        rest: "catalog/young-events",
        root: "catalog",
        field: "youngEvent",
        key: "youngId",
        type: "String!",
        tool: "catalog_young_event_get",
        present: youngId,
        missing: missingId,
      },
      {
        rest: "catalog/young-organizers",
        root: "catalog",
        field: "youngOrganizer",
        key: "organizerId",
        type: "String!",
        tool: "catalog_young_organizer_get",
        present: organizerId,
        missing: missingId,
      },
      {
        rest: "community/users",
        root: "community",
        field: "user",
        key: "identifier",
        type: "String!",
        tool: "community_user_get",
        present: h.actors[0].id,
        missing: missingId,
      },
    ];
    async function graphql(query: string, variables: Record<string, unknown>) {
      const response = await fetch(`${h.origin}/api/graphql`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.errors).toBeUndefined();
      return body.data;
    }
    async function native(
      name: string,
      args: Record<string, unknown>,
      profile = false,
    ) {
      const response = await fetch(`${h.origin}/api/mcp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...(profile
            ? { authorization: `Bearer ${h.actors[0].readTokens.mcp}` }
            : {}),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name,
            arguments: { ...args, mode: "full", locale: "zh-cn" },
          },
        }),
      });
      expect(response.status).toBe(200);
      const text = await response.text();
      const data = response.headers
        .get("content-type")
        ?.includes("text/event-stream")
        ? text
            .split("\n")
            .filter((line) => line.startsWith("data: "))
            .at(-1)
            ?.slice(6)
        : text;
      if (!data) throw new Error("Missing MCP response");
      const rpc = JSON.parse(data);
      expect(rpc.error).toBeUndefined();
      expect(rpc.result.isError).not.toBe(true);
      return JSON.parse(
        rpc.result.content.find(
          (part: { type: string }) => part.type === "text",
        ).text,
      );
    }
    const before = await h.snapshot();
    for (const entry of cases)
      for (const exists of [true, false]) {
        const id = exists ? entry.present : entry.missing;
        const response = await fetch(`${h.origin}/api/${entry.rest}/${id}`);
        expect(response.status, entry.field).toBe(exists ? 200 : 404);
        const rest = await response.json();
        const field = entry.field === "youngEvent" ? "youngId" : "id";
        const graph = await graphql(
          `query($id:${entry.type}) { ${entry.root} { ${entry.field}(${entry.key}:$id) { ${field} } } }`,
          { id },
        );
        const tool = await native(
          entry.tool,
          { [entry.key]: id },
          entry.root === "community",
        );
        if (exists) {
          expect(graph[entry.root][entry.field], entry.field).not.toBeNull();
          expect(tool.success, entry.field).toBe(true);
        } else {
          expect(rest, entry.field).toEqual({
            error: expect.stringMatching(/not found/i),
          });
          expect(graph[entry.root][entry.field], entry.field).toBeNull();
          expect(tool, entry.field).toMatchObject({
            success: false,
            error: "not_found",
          });
          if ("found" in tool) expect(tool.found).toBe(false);
        }
      }
    // Bus route detail has GraphQL/native counterparts; REST exposes a complete
    // timetable, so no fictitious per-route REST request participates here.
    expect(
      (
        await graphql(
          "query($id:Int!) { catalog { busTimetable(routeId:$id) { route { id } } } }",
          { id: 2147483647 },
        )
      ).catalog.busTimetable,
    ).toBeNull();
    expect(
      await native("catalog_bus_route_get", { routeId: 2147483647 }),
    ).toMatchObject({ success: false, error: "not_found", hasData: false });
    expect(await h.snapshot()).toEqual(before);
  } finally {
    await h.db.youngEvent.deleteMany({ where: { youngId } });
    await h.db.youngOrganizer.deleteMany({ where: { id: organizerId } });
    await h.cleanup();
  }
});
