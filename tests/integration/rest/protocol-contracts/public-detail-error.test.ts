import { expect } from "@playwright/test";
import { type ProtocolFixture, test } from "./_fixture";

test.use({ features: ["community.user"] });
async function snapshot(h: ProtocolFixture) {
  return {
    courses: await h.db.course.findMany({
      where: { id: { in: h.fixture.courses.map((row) => row.id) } },
      orderBy: { id: "asc" },
    }),
    sections: await h.db.section.findMany({
      where: { id: { in: h.fixture.sections.map((row) => row.id) } },
      orderBy: { id: "asc" },
    }),
    teachers: await h.db.teacher.findMany({
      where: { id: { in: h.fixture.teachers.map((row) => row.id) } },
      orderBy: { id: "asc" },
    }),
    users: await h.db.user.findMany({
      where: { id: { in: h.actors.map((actor) => actor.id) } },
      orderBy: { id: "asc" },
    }),
    event: await h.db.youngEvent.findUnique({ where: { youngId: h.youngId } }),
    organizer: await h.db.youngOrganizer.findUnique({
      where: { id: h.organizerId },
    }),
    comments: await h.db.comment.findMany({
      where: { sectionId: h.section.id },
      orderBy: { id: "asc" },
      include: {
        reactions: { orderBy: { id: "asc" } },
        attachments: { orderBy: { id: "asc" } },
      },
    }),
    homeworks: await h.db.homework.findMany({
      where: { sectionId: h.section.id },
      orderBy: { id: "asc" },
      include: { homeworkCompletions: { orderBy: { userId: "asc" } } },
    }),
    descriptions: await h.db.description.findMany({
      where: { sectionId: h.section.id },
      orderBy: { id: "asc" },
      include: { edits: { orderBy: { id: "asc" } } },
    }),
    audits: await h.db.auditLog.findMany({
      where: { userId: { in: h.actors.map((a) => a.id) } },
    }),
  };
}
async function graphql(
  h: ProtocolFixture,
  query: string,
  variables: Record<string, unknown>,
) {
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
  h: ProtocolFixture,
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
    rpc.result.content.find((part: { type: string }) => part.type === "text")
      .text,
  );
}

const cases = [
  {
    rest: "catalog/courses",
    root: "catalog",
    field: "course",
    key: "jwId",
    type: "Int!",
    tool: "catalog_course_get",
    present: (h: ProtocolFixture) => h.fixture.courses[0].jwId,
    missing: (h: ProtocolFixture) => h.fixture.base + 99,
  },
  {
    rest: "catalog/sections",
    root: "catalog",
    field: "section",
    key: "jwId",
    type: "Int!",
    tool: "catalog_section_get",
    present: (h: ProtocolFixture) => h.section.jwId,
    missing: (h: ProtocolFixture) => h.fixture.base + 99,
  },
  {
    rest: "catalog/teachers",
    root: "catalog",
    field: "teacher",
    key: "id",
    type: "Int!",
    tool: "catalog_teacher_get",
    present: (h: ProtocolFixture) => h.fixture.teachers[0].id,
    missing: () => 2147483647,
  },
  {
    rest: "catalog/young-events",
    root: "catalog",
    field: "youngEvent",
    key: "youngId",
    type: "String!",
    tool: "catalog_young_event_get",
    present: (h: ProtocolFixture) => h.youngId,
    missing: (h: ProtocolFixture) => `${h.marker}-missing`,
  },
  {
    rest: "catalog/young-organizers",
    root: "catalog",
    field: "youngOrganizer",
    key: "organizerId",
    type: "String!",
    tool: "catalog_young_organizer_get",
    present: (h: ProtocolFixture) => h.organizerId,
    missing: (h: ProtocolFixture) => `${h.marker}-missing`,
  },
  {
    rest: "community/users",
    root: "community",
    field: "user",
    key: "identifier",
    type: "String!",
    tool: "community_user_get",
    present: (h: ProtocolFixture) => h.actors[0].id,
    missing: (h: ProtocolFixture) => `${h.marker}-missing`,
  },
] as const;

for (const entry of cases) {
  test(`interface-hierarchy.public-detail-not-found-parity.${entry.field}`, async ({
    h,
  }) => {
    if (entry.field === "youngEvent" || entry.field === "youngOrganizer") {
      await h.db.youngOrganizer.create({
        data: {
          id: h.organizerId,
          name: h.organizerId,
          normalizedName: h.organizerId,
        },
      });
    }
    if (entry.field === "youngEvent") {
      await h.db.youngEvent.create({
        data: {
          youngId: h.youngId,
          name: h.youngId,
          organizerId: h.organizerId,
          rawJson: {},
          isActive: true,
        },
      });
    }
    const before = await snapshot(h);
    for (const exists of [true, false]) {
      const id = exists ? entry.present(h) : entry.missing(h);
      const response = await fetch(`${h.origin}/api/${entry.rest}/${id}`);
      expect(response.status, entry.field).toBe(exists ? 200 : 404);
      const rest = await response.json();
      const field = entry.field === "youngEvent" ? "youngId" : "id";
      const graph = await graphql(
        h,
        `query($id:${entry.type}) { ${entry.root} { ${entry.field}(${entry.key}:$id) { ${field} } } }`,
        { id },
      );
      const tool = await native(
        h,
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

    expect(await snapshot(h)).toEqual(before);
  });
}

test("interface-hierarchy.public-detail-not-found-parity.bus", async ({
  h,
}) => {
  const before = await snapshot(h);
  // Bus route detail has GraphQL/native counterparts; REST exposes a complete
  // timetable, so no fictitious per-route REST request participates here.
  expect(
    (
      await graphql(
        h,
        "query($id:Int!) { catalog { busTimetable(routeId:$id) { route { id } } } }",
        { id: 2147483647 },
      )
    ).catalog.busTimetable,
  ).toBeNull();
  expect(
    await native(h, "catalog_bus_route_get", { routeId: 2147483647 }),
  ).toMatchObject({ success: false, error: "not_found", hasData: false });
  expect(await snapshot(h)).toEqual(before);
});
