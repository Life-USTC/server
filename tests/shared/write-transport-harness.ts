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
import {
  cleanupCatalogContractFixture,
  createCatalogContractFixture,
} from "./catalog-contract-fixture";
import { createFixturePrisma } from "./prisma";

export const transports = ["rest", "graphql", "mcp"] as const;
type Transport = (typeof transports)[number];
type Tokens = Record<Transport, string>;
type Actor = { id: string; cookie: string; tokens: Tokens; readTokens: Tokens };
export type Operation = {
  rest: {
    path: string;
    method: string;
    body?: Record<string, unknown>;
    form?: Record<string, string>;
  };
  graphql: { query: string; variables: Record<string, unknown>; field: string };
  mcp: { name: string; arguments: Record<string, unknown> };
};
export type Outcome =
  | "success"
  | "anonymous"
  | "read_scope"
  | "forbidden"
  | "suspended"
  | "locked"
  | "deleted"
  | "not_found"
  | "target_not_found"
  | "parent_not_found"
  | "invalid_attachments";

export async function createWriteTransportHarness(features: string[]) {
  const db = createFixturePrisma();
  const fixture = await createCatalogContractFixture(db);
  const [section] = fixture.sections;
  const graphql = createGraphqlRequestHandler(false);
  let origin = "";
  let invalidations = 0;
  const calendarRebuilds: unknown[] = [];
  function runtime<T>(work: () => T) {
    if (!process.env.DATABASE_URL || !process.env.AUTH_DATABASE_URL)
      throw new Error("Missing restricted runtime database URLs");
    return runWithCloudflareRuntimeEnv(
      {
        APP_PUBLIC_ORIGIN: origin,
        HYPERDRIVE: { connectionString: process.env.DATABASE_URL },
        HYPERDRIVE_AUTH: { connectionString: process.env.AUTH_DATABASE_URL },
        CALENDAR_EXPORT_REBUILD: {
          async send(message: unknown) {
            calendarRebuilds.push(structuredClone(message));
          },
        },
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
  const scopes = features.flatMap((feature) => [
    `${feature}:write`,
    `${feature}:read`,
  ]);
  const clientId = `${fixture.marker}-writes`;
  await db.oAuthClient.create({
    data: {
      clientId,
      name: fixture.marker,
      scopes,
      redirectUris: ["https://example.test/callback"],
    },
  });
  const restAudience = await runtime(() => getOAuthRestAudienceUrls()[0]);
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
      rest: restAudience,
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
            scopes: features.map((feature) => `${feature}:${action}`),
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
      "content-type":
        transport === "rest" && operation.rest.form
          ? "application/x-www-form-urlencoded"
          : "application/json",
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
            ? operation.rest.form
              ? new URLSearchParams(operation.rest.form).toString()
              : operation.rest.body
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
    const invalid = expected === "invalid_attachments";
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
      expect(response.status, text).toBe(missing ? 404 : invalid ? 400 : 403);
      if (transport === "graphql")
        expect(payload.errors[0].extensions.code).toBe(
          missing ? "NOT_FOUND" : invalid ? "BAD_USER_INPUT" : "FORBIDDEN",
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
      calendarRebuilds: structuredClone(calendarRebuilds),
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
    origin,
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
      await db.featureOperationEvent.deleteMany({
        where: { userId: { in: actors.map((actor) => actor.id) } },
      });
      await db.user.deleteMany({
        where: { id: { in: actors.map((actor) => actor.id) } },
      });
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
      await db.$disconnect();
    },
  };
}
