import { createServer } from "node:http";
import type { RequestEvent } from "@sveltejs/kit";
import { getRequest, setResponse } from "@sveltejs/kit/node";
import { makeSignature } from "better-auth/crypto";
import { expect } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import {
  runWithCloudflareRuntimeEnv,
  setCloudflareCatalogInvalidator,
} from "@/lib/adapters/cloudflare-runtime";
import { postCommentReactionRoute } from "@/lib/api/routes/comment-reaction-create-route";
import { deleteCommentReactionRoute } from "@/lib/api/routes/comment-reaction-delete-route";
import { postCommentRoute } from "@/lib/api/routes/comments-create-route";
import { patchCommentRoute } from "@/lib/api/routes/comments-update-route";
import { postDescriptionRoute } from "@/lib/api/routes/description-upsert-route";
import {
  patchHomeworkRoute,
  postHomeworkRoute,
} from "@/lib/api/routes/homework-mutation-routes";
import { mcpPostRoute } from "@/lib/api/routes/mcp";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { getOAuthRestAudienceUrls } from "@/lib/oauth/resource-urls";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";
import {
  cleanupCatalogContractFixture,
  createCatalogContractFixture,
} from "./catalog-contract-fixture";
import { createFixturePrisma } from "./prisma";

const transports = ["rest", "graphql", "mcp"] as const;
type Transport = (typeof transports)[number];
type Tokens = Record<Transport, string>;
type Actor = { id: string; cookie: string; tokens: Tokens; readTokens: Tokens };
type Operation = {
  rest: { path: string; method: string; body?: Record<string, unknown> };
  graphql: { query: string; variables: Record<string, unknown>; field: string };
  mcp: { name: string; arguments: Record<string, unknown> };
};
type Outcome =
  | "success"
  | "anonymous"
  | "read_scope"
  | "forbidden"
  | "suspended"
  | "locked"
  | "deleted"
  | "not_found"
  | "target_not_found"
  | "parent_not_found";

async function withWriteParity(
  feature:
    | "community.comment"
    | "community.description"
    | "community.section-homework",
  run: (h: Awaited<ReturnType<typeof createHarness>>) => Promise<void>,
) {
  const harness = await createHarness(feature);
  try {
    await run(harness);
  } finally {
    await harness.cleanup();
  }
}
async function createHarness(feature: string) {
  const db = createFixturePrisma();
  const fixture = await createCatalogContractFixture(db);
  const [section] = fixture.sections;
  const previousOrigin = process.env.APP_PUBLIC_ORIGIN;
  const graphql = createGraphqlRequestHandler(false);
  let origin = "";
  let invalidations = 0;
  function runtime<T>(work: () => T) {
    if (!process.env.DATABASE_URL || !process.env.AUTH_DATABASE_URL)
      throw new Error("Missing restricted runtime database URLs");
    return runWithCloudflareRuntimeEnv(
      {
        HYPERDRIVE: { connectionString: process.env.DATABASE_URL },
        HYPERDRIVE_AUTH: { connectionString: process.env.AUTH_DATABASE_URL },
        // The rate-limit contract is independent of business authorization.
        USER_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
      },
      () => {
        setCloudflareCatalogInvalidator(async () => {
          invalidations += 1;
        });
        return work();
      },
    );
  }
  const server = createServer(async (incoming, outgoing) => {
    try {
      const request = await getRequest({ request: incoming, base: origin });
      const response = await runtime(async () => {
        const path = new URL(request.url).pathname;
        if (path === "/api/auth/jwks")
          return getBetterAuthInstance().handler(request);
        if (path === "/api/mcp") return mcpPostRoute(request);
        if (path === "/api/graphql")
          return graphql({
            request,
            locals: {
              authUser: null,
              locale: "zh-cn",
              requestId: fixture.marker,
            },
          } as unknown as RequestEvent);
        if (path === "/api/community/comments")
          return postCommentRoute(request);
        if (path === "/api/community/descriptions")
          return postDescriptionRoute(request);
        if (path === "/api/community/section-homeworks")
          return postHomeworkRoute(request);
        const comment = path.match(
          /^\/api\/community\/comments\/([^/]+)(\/reactions)?$/,
        );
        if (comment) {
          const params = { id: comment[1] };
          if (!comment[2]) return patchCommentRoute(request, params);
          return request.method === "POST"
            ? postCommentReactionRoute(request, params)
            : deleteCommentReactionRoute(request, params);
        }
        const homework = path.match(
          /^\/api\/community\/section-homeworks\/([^/]+)$/,
        );
        if (homework) return patchHomeworkRoute(request, { id: homework[1] });
        return new Response(null, { status: 404 });
      });
      await setResponse(outgoing, response);
    } catch (error) {
      outgoing.statusCode = 500;
      outgoing.end(String(error));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing server address");
  origin = `http://127.0.0.1:${address.port}`;
  process.env.APP_PUBLIC_ORIGIN = origin;
  const scopes = [`${feature}:write`, `${feature}:read`];
  const clientId = `${fixture.marker}-writes`;
  await db.oAuthClient.create({
    data: {
      clientId,
      name: fixture.marker,
      scopes,
      redirectUris: ["https://example.test/callback"],
    },
  });
  const actors: Actor[] = [];
  for (let index = 0; index < 2; index++) {
    const id = `${fixture.marker}-writer-${index}`;
    await db.user.create({
      data: { id, name: id, email: `${id}@example.test` },
    });
    const sessionToken = crypto.randomUUID();
    await db.session.create({
      data: {
        userId: id,
        sessionToken,
        expires: new Date(Date.now() + 3600000),
      },
    });
    const context = await runtime(() => getBetterAuthInstance().$context);
    const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${sessionToken}.${await makeSignature(sessionToken, context.secret)}`)}`;
    const grant = await db.oAuthConsent.create({
      data: { clientId, userId: id, scopes },
    });
    const tokens = {} as Tokens;
    const readTokens = {} as Tokens;
    for (const [transport, resource] of Object.entries({
      rest: getOAuthRestAudienceUrls()[0],
      graphql: `${origin}/api/graphql`,
      mcp: `${origin}/api/mcp`,
    })) {
      for (const [destination, action] of [
        [tokens, "write"],
        [readTokens, "read"],
      ] as const) {
        const issuedAt = Math.floor(Date.now() / 1000);
        const token = await runtime(() =>
          signResourceBoundOAuthAccessToken({
            clientId,
            grantId: grant.grantId,
            userId: id,
            scopes: [`${feature}:${action}`],
            resources: [resource],
            issuedAt,
            expiresAt: issuedAt + 600,
          }),
        );
        if (!token) throw new Error("Missing signed resource token");
        destination[transport as Transport] = token;
      }
    }
    actors.push({ id, cookie, tokens, readTokens });
  }
  async function call(
    transport: Transport,
    operation: Operation,
    actor: Actor,
    expected: Outcome = "success",
    session = false,
  ) {
    const token =
      expected === "read_scope"
        ? actor.readTokens[transport]
        : actor.tokens[transport];
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      origin,
      ...(expected === "anonymous"
        ? {}
        : session
          ? { cookie: actor.cookie }
          : { authorization: `Bearer ${token}` }),
    };
    const response = await fetch(
      `${origin}${transport === "rest" ? operation.rest.path : `/api/${transport}`}`,
      {
        headers,
        method: transport === "rest" ? operation.rest.method : "POST",
        body:
          transport === "rest"
            ? operation.rest.body
              ? JSON.stringify(operation.rest.body)
              : undefined
            : JSON.stringify(
                transport === "graphql"
                  ? {
                      query: operation.graphql.query,
                      variables: operation.graphql.variables,
                    }
                  : {
                      jsonrpc: "2.0",
                      id: 1,
                      method: "tools/call",
                      params: {
                        name: operation.mcp.name,
                        arguments: {
                          ...operation.mcp.arguments,
                          mode: "full",
                          locale: "zh-cn",
                        },
                      },
                    },
              ),
      },
    );
    const text = await response.text();
    const encoded = response.headers
      .get("content-type")
      ?.includes("text/event-stream")
      ? text
          .split("\n")
          .filter((line) => line.startsWith("data: "))
          .at(-1)
          ?.slice(6)
      : text;
    if (!encoded) throw new Error("Missing transport response");
    const payload = JSON.parse(encoded);
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
    const missing = [
      "not_found",
      "target_not_found",
      "parent_not_found",
    ].includes(expected);
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
      expect(response.status, text).toBe(missing ? 404 : 403);
      if (transport === "graphql")
        expect(payload.errors[0].extensions.code).toBe(
          missing ? "NOT_FOUND" : "FORBIDDEN",
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
  async function snapshot() {
    return {
      invalidations,
      comments: await db.comment.findMany({
        where: { sectionId: section.id },
        orderBy: { id: "asc" },
        include: {
          reactions: { orderBy: { id: "asc" } },
          attachments: { orderBy: { id: "asc" } },
        },
      }),
      homeworks: await db.homework.findMany({
        where: { sectionId: section.id },
        orderBy: { id: "asc" },
        include: { homeworkCompletions: { orderBy: { userId: "asc" } } },
      }),
      descriptions: await db.description.findMany({
        where: { sectionId: section.id },
        orderBy: { id: "asc" },
        include: { edits: { orderBy: { id: "asc" } } },
      }),
      audits: await db.auditLog.findMany({
        where: {
          userId: { in: actors.map((actor) => actor.id) },
          action: {
            in: [
              "comment_create",
              "comment_edit",
              "comment_react",
              "description_edit",
              "homework_create",
              "homework_update",
            ],
          },
        },
        orderBy: { id: "asc" },
      }),
    };
  }
  return {
    db,
    fixture,
    section,
    actors,
    call,
    snapshot,
    async cleanup() {
      await db.comment.deleteMany({ where: { sectionId: section.id } });
      await cleanupCatalogContractFixture(db, fixture);
      await db.auditLog.deleteMany({
        where: {
          OR: [
            { userId: { in: actors.map((actor) => actor.id) } },
            { subjectUserId: { in: actors.map((actor) => actor.id) } },
          ],
        },
      });
      await db.oAuthClient.delete({ where: { clientId } });
      await db.user.deleteMany({
        where: { id: { in: actors.map((actor) => actor.id) } },
      });
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
      await db.$disconnect();
      if (previousOrigin === undefined) delete process.env.APP_PUBLIC_ORIGIN;
      else process.env.APP_PUBLIC_ORIGIN = previousOrigin;
      resetPublicRuntimeCacheForTest();
    },
  };
}

function commentCreate(
  sectionJwId: number,
  body: string,
  parentId?: string,
): Operation {
  const input = {
    targetType: "section",
    sectionJwId,
    body,
    ...(parentId ? { parentId } : {}),
  };
  return {
    rest: { path: "/api/community/comments", method: "POST", body: input },
    graphql: {
      field: "commentCreate",
      query:
        "mutation($input: CreateCommentInput!) { commentCreate(input:$input) { id } }",
      variables: { input: { ...input, targetType: "SECTION" } },
    },
    mcp: { name: "community_comment_create", arguments: input },
  };
}
function commentUpdate(id: string, body: string): Operation {
  return {
    rest: {
      path: `/api/community/comments/${id}`,
      method: "PATCH",
      body: { body },
    },
    graphql: {
      field: "commentUpdate",
      query:
        "mutation($id: ID!, $input: UpdateCommentInput!) { commentUpdate(id:$id,input:$input) { id } }",
      variables: { id, input: { body } },
    },
    mcp: {
      name: "community_comment_update",
      arguments: { commentId: id, body },
    },
  };
}
function reaction(id: string, add: boolean): Operation {
  const field = add ? "commentReactionAdd" : "commentReactionRemove";
  return {
    rest: {
      path: `/api/community/comments/${id}/reactions${add ? "" : "?type=heart"}`,
      method: add ? "POST" : "DELETE",
      ...(add ? { body: { type: "heart" } } : {}),
    },
    graphql: {
      field,
      query: `mutation($id: ID!) { ${field}(commentId:$id,type:HEART) { active changed } }`,
      variables: { id },
    },
    mcp: {
      name: `community_comment_reaction_${add ? "add" : "remove"}`,
      arguments: { commentId: id, type: "heart" },
    },
  };
}
function descriptionSet(sectionJwId: number, content: string): Operation {
  const input = { targetType: "section", sectionJwId, content };
  return {
    rest: { path: "/api/community/descriptions", method: "POST", body: input },
    graphql: {
      field: "descriptionSet",
      query:
        "mutation($input: UpsertDescriptionInput!) { descriptionSet(input:$input) { id updated } }",
      variables: { input: { ...input, targetType: "SECTION" } },
    },
    mcp: { name: "community_description_set", arguments: input },
  };
}
function homeworkCreate(sectionJwId: number, title: string): Operation {
  const input = { sectionJwId, title };
  return {
    rest: {
      path: "/api/community/section-homeworks",
      method: "POST",
      body: input,
    },
    graphql: {
      field: "homeworkCreate",
      query:
        "mutation($input: CreateHomeworkInput!) { homeworkCreate(input:$input) { id } }",
      variables: { input },
    },
    mcp: { name: "community_section_homework_create", arguments: input },
  };
}
function homeworkUpdate(id: string, title: string): Operation {
  return {
    rest: {
      path: `/api/community/section-homeworks/${id}`,
      method: "PATCH",
      body: { title },
    },
    graphql: {
      field: "homeworkUpdate",
      query:
        "mutation($id: ID!, $input: UpdateHomeworkInput!) { homeworkUpdate(id:$id,input:$input) { id } }",
      variables: { id, input: { title } },
    },
    mcp: {
      name: "community_section_homework_update",
      arguments: { homeworkId: id, title },
    },
  };
}

export async function assertCommentWriteTransportAuthorization() {
  await withWriteParity("community.comment", async (h) => {
    const [owner] = h.actors;
    const rows = await Promise.all(
      h.actors.map((actor) =>
        h.db.comment.create({
          data: {
            sectionId: h.section.id,
            userId: actor.id,
            body: `Original ${actor.id}`,
          },
        }),
      ),
    );
    for (const transport of transports) {
      for (const [index, actor] of h.actors.entries()) {
        const own = rows[index];
        const foreign = rows[1 - index];
        const body = `Edited by ${actor.id} through ${transport}`;
        await h.call(transport, commentUpdate(own.id, body), actor);
        expect(
          await h.db.comment.findUnique({ where: { id: own.id } }),
        ).toMatchObject({ body, userId: actor.id });
        const created = await h.call(
          transport,
          commentCreate(h.section.jwId, body),
          actor,
        );
        expect(
          await h.db.comment.findUnique({ where: { id: created.id } }),
        ).toMatchObject({ body, userId: actor.id });
        const reply = await h.call(
          transport,
          commentCreate(h.section.jwId, body, foreign.id),
          actor,
        );
        expect(
          await h.db.comment.findUnique({ where: { id: reply.id } }),
        ).toMatchObject({ userId: actor.id, parentId: foreign.id });
        await h.call(transport, reaction(foreign.id, true), actor);
        expect(
          await h.db.commentReaction.findMany({
            where: { commentId: foreign.id, userId: actor.id },
          }),
        ).toHaveLength(1);
        await h.call(transport, reaction(foreign.id, false), actor);
        expect(
          await h.db.commentReaction.count({
            where: { commentId: foreign.id, userId: actor.id },
          }),
        ).toBe(0);
        const before = await h.snapshot();
        await h.call(
          transport,
          commentUpdate(foreign.id, "Rejected foreign edit"),
          actor,
          "forbidden",
        );
        expect(await h.snapshot()).toEqual(before);
      }
    }
    for (const transport of ["rest", "graphql"] as const) {
      const body = `Session edit ${transport}`;
      await h.call(
        transport,
        commentUpdate(rows[0].id, body),
        owner,
        "success",
        true,
      );
      expect(
        await h.db.comment.findUnique({ where: { id: rows[0].id } }),
      ).toMatchObject({ body, userId: owner.id });
    }
    for (const status of ["deleted", "softbanned"] as const) {
      const locked = await h.db.comment.create({
        data: {
          sectionId: h.section.id,
          userId: owner.id,
          body: "Locked original",
          status,
        },
      });
      const before = await h.snapshot();
      for (const transport of transports)
        for (const operation of [
          commentUpdate(locked.id, "Rejected lock edit"),
          commentCreate(h.section.jwId, "Rejected lock reply", locked.id),
          reaction(locked.id, true),
          reaction(locked.id, false),
        ])
          await h.call(transport, operation, owner, "locked");
      expect(await h.snapshot()).toEqual(before);
    }
    for (const transport of transports) {
      const before = await h.snapshot();
      await h.call(
        transport,
        commentUpdate(`${h.fixture.marker}-missing`, "Missing edit"),
        owner,
        "not_found",
      );
      await h.call(
        transport,
        commentCreate(
          h.section.jwId,
          "Missing parent",
          `${h.fixture.marker}-missing`,
        ),
        owner,
        "parent_not_found",
      );
      for (const outcome of ["anonymous", "read_scope"] as const)
        for (const operation of [
          commentCreate(h.section.jwId, "Rejected creation"),
          commentUpdate(rows[0].id, "Rejected edit"),
          commentCreate(h.section.jwId, "Rejected reply", rows[0].id),
          reaction(rows[0].id, true),
          reaction(rows[0].id, false),
        ])
          await h.call(transport, operation, owner, outcome);
      expect(await h.snapshot()).toEqual(before);
    }
    await h.db.userSuspension.create({
      data: { userId: owner.id, reason: h.fixture.marker },
    });
    const before = await h.snapshot();
    for (const transport of transports)
      for (const operation of [
        commentCreate(h.section.jwId, "Suspended create"),
        commentUpdate(rows[0].id, "Suspended edit"),
        commentCreate(h.section.jwId, "Suspended reply", rows[1].id),
        reaction(rows[1].id, true),
        reaction(rows[1].id, false),
      ])
        await h.call(transport, operation, owner, "suspended");
    expect(await h.snapshot()).toEqual(before);
    // Session callers reach the same current suspension gate, without OAuth scopes.
    await h.call(
      "rest",
      commentUpdate(rows[0].id, "Suspended session"),
      owner,
      "suspended",
      true,
    );
    await h.call(
      "graphql",
      commentUpdate(rows[0].id, "Suspended session"),
      owner,
      "suspended",
      true,
    );
    expect(await h.snapshot()).toEqual(before);
  });
}

export async function assertDescriptionWriteTransportAuthorization() {
  await withWriteParity("community.description", async (h) => {
    const [owner, other] = h.actors;
    let id: string | undefined;
    for (const transport of transports)
      for (const actor of h.actors) {
        const content = `Collaborative ${actor.id} ${transport}`;
        const result = await h.call(
          transport,
          descriptionSet(h.section.jwId, content),
          actor,
        );
        if (id) expect(result.id).toBe(id);
        else id = result.id;
        expect(
          await h.db.description.findUnique({ where: { id: result.id } }),
        ).toMatchObject({ content, lastEditedById: actor.id });
      }
    expect(
      await h.db.descriptionEdit.count({ where: { descriptionId: id } }),
    ).toBe(6);
    for (const transport of ["rest", "graphql"] as const) {
      const content = `Collaborative session ${transport}`;
      const result = await h.call(
        transport,
        descriptionSet(h.section.jwId, content),
        owner,
        "success",
        true,
      );
      expect(result.id).toBe(id);
      expect(
        await h.db.description.findUnique({ where: { id } }),
      ).toMatchObject({ content, lastEditedById: owner.id });
    }
    const before = await h.snapshot();
    for (const transport of transports) {
      await h.call(
        transport,
        descriptionSet(h.section.id, "Wrong identifier"),
        owner,
        "target_not_found",
      );
      for (const outcome of ["anonymous", "read_scope"] as const)
        await h.call(
          transport,
          descriptionSet(h.section.jwId, "Rejected editor"),
          owner,
          outcome,
        );
    }
    expect(await h.snapshot()).toEqual(before);
    await h.db.userSuspension.create({
      data: { userId: other.id, reason: h.fixture.marker },
    });
    for (const transport of transports)
      await h.call(
        transport,
        descriptionSet(h.section.jwId, "Suspended editor"),
        other,
        "suspended",
      );
    for (const transport of ["rest", "graphql"] as const)
      await h.call(
        transport,
        descriptionSet(h.section.jwId, "Suspended session"),
        other,
        "suspended",
        true,
      );
    expect(await h.snapshot()).toEqual(before);
  });
}

export async function assertHomeworkWriteTransportAuthorization() {
  await withWriteParity("community.section-homework", async (h) => {
    const [owner, other] = h.actors;
    const shared = await h.db.homework.create({
      data: {
        sectionId: h.section.id,
        createdById: owner.id,
        title: "Original shared homework",
      },
    });
    for (const transport of transports)
      for (const actor of h.actors) {
        const title = `Collaborative ${actor.id} ${transport}`;
        const created = await h.call(
          transport,
          homeworkCreate(h.section.jwId, title),
          actor,
        );
        expect(
          await h.db.homework.findUnique({ where: { id: created.id } }),
        ).toMatchObject({ title, createdById: actor.id });
        await h.call(transport, homeworkUpdate(shared.id, title), actor);
        expect(
          await h.db.homework.findUnique({ where: { id: shared.id } }),
        ).toMatchObject({
          title,
          createdById: owner.id,
          updatedById: actor.id,
        });
      }
    for (const transport of ["rest", "graphql"] as const) {
      const title = `Collaborative session ${transport}`;
      await h.call(
        transport,
        homeworkUpdate(shared.id, title),
        other,
        "success",
        true,
      );
      expect(
        await h.db.homework.findUnique({ where: { id: shared.id } }),
      ).toMatchObject({ title, createdById: owner.id, updatedById: other.id });
    }
    const deleted = await h.db.homework.create({
      data: {
        sectionId: h.section.id,
        createdById: owner.id,
        title: "Deleted assignment",
        deletedAt: new Date(),
        deletedById: owner.id,
      },
    });
    const before = await h.snapshot();
    for (const transport of transports) {
      await h.call(
        transport,
        homeworkUpdate(deleted.id, "Rejected restore"),
        owner,
        "deleted",
      );
      await h.call(
        transport,
        homeworkUpdate(`${h.fixture.marker}-missing`, "Missing assignment"),
        owner,
        "not_found",
      );
      await h.call(
        transport,
        homeworkCreate(h.section.id, "Wrong section identifier"),
        owner,
        "not_found",
      );
      for (const outcome of ["anonymous", "read_scope"] as const)
        for (const operation of [
          homeworkCreate(h.section.jwId, "Rejected creation"),
          homeworkUpdate(shared.id, "Rejected editor"),
        ])
          await h.call(transport, operation, owner, outcome);
    }
    expect(await h.snapshot()).toEqual(before);
    await h.db.userSuspension.create({
      data: { userId: other.id, reason: h.fixture.marker },
    });
    for (const transport of transports)
      for (const operation of [
        homeworkCreate(h.section.jwId, "Suspended creation"),
        homeworkUpdate(shared.id, "Suspended editor"),
      ])
        await h.call(transport, operation, other, "suspended");
    for (const transport of ["rest", "graphql"] as const)
      await h.call(
        transport,
        homeworkUpdate(shared.id, "Suspended session"),
        other,
        "suspended",
        true,
      );
    expect(await h.snapshot()).toEqual(before);
  });
}
