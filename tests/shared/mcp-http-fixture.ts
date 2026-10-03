import { betterAuth } from "better-auth";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import type { CloudflareR2Bucket } from "@/lib/adapters/cloudflare-runtime";
import {
  mcpDeleteRoute,
  mcpGetRoute,
  mcpOptionsRoute,
  mcpPostRoute,
} from "@/lib/api/routes/mcp";
import { getUploadDownloadRoute } from "@/lib/api/routes/upload-download-route";
import { putUploadObjectRoute } from "@/lib/api/routes/upload-object-put-route";
import { buildBetterAuthOptions } from "@/lib/auth/better-auth-options";
import { DEV_SEED_ANCHOR } from "../fixtures/dev-seed";
import {
  type IsolatedDatabase,
  isolatedDatabaseTest,
} from "./isolated-database";
import { ownHttpServer } from "./node-http-contract-fixture";
import { createNodeRuntime } from "./node-runtime";

export const call = (name: string, args: Record<string, unknown> = {}) => ({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: { name, arguments: args },
});

export async function payload(response: Response) {
  const text = await response.text();
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = text
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .at(-1)
      ?.slice(6);
    if (!data) throw new Error(`Missing MCP SSE data: ${text}`);
    return JSON.parse(data);
  }
  return JSON.parse(text);
}

/** Real Node HTTP routes and JWT/JWKS verification, with a private memory R2.
 * Deployment hooks and OAuth issuance flows belong to the Worker E2E suite. */
function ownMcpHttpFixture(database: IsolatedDatabase) {
  const db = database.owner;
  const marker = crypto.randomUUID();
  const userId = `mcp-http-${marker}`;
  const clientId = `mcp-http-client-${marker}`;
  const grantId = `mcp-http-grant-${marker}`;
  const scopes = [
    "workspace.todo:read",
    "workspace.todo:write",
    "account.profile:read",
    "workspace.upload:write",
    "workspace.upload:read",
    "workspace.overview:read",
    "workspace.schedule:read",
    "workspace.calendar:read",
  ];
  const objects = new Map<string, Uint8Array>();
  const calendarMessages: unknown[] = [];
  const bucket: CloudflareR2Bucket = {
    async head(key) {
      const bytes = objects.get(key);
      return bytes
        ? {
            size: bytes.byteLength,
            httpMetadata: { contentType: "text/plain" },
          }
        : null;
    },
    async get(key) {
      const bytes = objects.get(key);
      return bytes
        ? {
            size: bytes.byteLength,
            body: new Response(new Uint8Array(bytes).buffer)
              .body as ReadableStream<Uint8Array>,
            httpMetadata: { contentType: "text/plain" },
          }
        : null;
    },
    async put(key, value) {
      objects.set(
        key,
        new Uint8Array(await new Response(value as BodyInit).arrayBuffer()),
      );
    },
    async delete(key) {
      objects.delete(key);
    },
  };
  let origin = "";
  let publicOrigin = "";
  let canonicalOrigin = "";
  let publicJwksRequests = 0;
  let auth: ReturnType<
    typeof betterAuth<ReturnType<typeof buildBetterAuthOptions>>
  >;
  const runtimes: ReturnType<typeof createNodeRuntime>[] = [];
  const workflows = createNodeRuntime({});
  let initialization: Promise<void> | undefined;
  let token = "";
  let closing: Promise<void> | undefined;
  let requestsClosed = false;
  function request<T>(work: () => T | Promise<T>): Promise<T> {
    if (requestsClosed)
      return Promise.reject(new Error("MCP HTTP requests are closed"));
    const runtime = createNodeRuntime({
      APP_PUBLIC_ORIGIN: publicOrigin,
      APP_CANONICAL_ORIGIN: canonicalOrigin,
      HYPERDRIVE: { connectionString: database.connections.app },
      HYPERDRIVE_AUTH: { connectionString: database.connections.auth },
      R2_UPLOADS: bucket,
      CALENDAR_EXPORT_REBUILD: {
        send: async (message: unknown) => {
          calendarMessages.push(message);
        },
      },
      USER_WRITE_RATE_LIMITER: { limit: async () => ({ success: true }) },
    });
    runtimes.push(runtime);
    return runtime.run(work);
  }
  const runtime = {
    request,
    drain: workflows.close,
    async close() {
      const results = await Promise.allSettled([workflows.close()]);
      requestsClosed = true;
      // A workflow may admit more requests after its native test times out.
      // Finish it before taking the final set of request runtimes.
      results.push(
        ...(await Promise.allSettled(runtimes.map((item) => item.close()))),
      );
      const failures = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length)
        throw new AggregateError(failures, "MCP HTTP runtime cleanup failed");
    },
  };
  const server = ownHttpServer(runtime, (incoming) => {
    const path = new URL(incoming.url).pathname;
    if (path === "/api/auth/jwks") {
      publicJwksRequests++;
      return auth.handler(incoming);
    }
    if (path === "/api/workspace/uploads/object")
      return putUploadObjectRoute(incoming);
    if (/^\/api\/workspace\/uploads\/[^/]+\/download$/.test(path))
      return getUploadDownloadRoute(incoming, { id: path.split("/")[4] });
    return (
      {
        POST: mcpPostRoute,
        GET: mcpGetRoute,
        DELETE: mcpDeleteRoute,
        OPTIONS: mcpOptionsRoute,
      }[incoming.method] ?? (() => new Response(null, { status: 405 }))
    )(incoming);
  });
  function close() {
    closing ??= (async () => {
      // The server drains workflows, client bodies and handlers while the JWKS
      // listener remains available. This owner reports runtime cleanup failures.
      const results = await Promise.allSettled([server.close()]);
      results.push(...(await Promise.allSettled([runtime.close()])));
      objects.clear();
      calendarMessages.length = 0;
      const failures = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length)
        throw new AggregateError(failures, "MCP HTTP fixture cleanup failed");
    })();
    return closing;
  }
  async function sign(
    input: {
      resource?: string;
      scopes?: string[];
      expired?: boolean;
      grantId?: string;
    } = {},
  ) {
    const issuedAt = Math.floor(Date.now() / 1000);
    const signed = await request(() =>
      signResourceBoundOAuthAccessToken({
        userId,
        clientId,
        grantId: input.grantId ?? grantId,
        scopes: input.scopes ?? scopes,
        resources: [input.resource ?? `${origin}/api/mcp`],
        issuedAt: input.expired ? issuedAt - 600 : issuedAt,
        expiresAt: input.expired ? issuedAt - 300 : issuedAt + 300,
      }),
    );
    if (!signed) throw new Error("Expected signed MCP token");
    return signed;
  }
  function initialize() {
    if (closing)
      return Promise.reject(new Error("MCP HTTP fixture is closing"));
    initialization ??= workflows.run(async () => {
      await server.initialize();
      origin = server.origin;
      publicOrigin = origin;
      canonicalOrigin = origin;
      auth = await request(async () => {
        const instance = betterAuth(buildBetterAuthOptions());
        await instance.$context;
        return instance;
      });
      await db.$transaction(async (tx) => {
        await tx.user.create({
          data: { id: userId, email: `${userId}@example.test` },
        });
        await tx.oAuthClient.create({
          data: {
            clientId,
            name: "MCP HTTP contract",
            scopes,
            redirectUris: ["https://example.test/callback"],
            consents: { create: { userId, grantId, scopes } },
          },
        });
      });
      token = await sign();
    });
    return initialization;
  }
  async function arrangeClock() {
    return db.$transaction(async (db) => {
      const semester = await db.semester.create({
        data: {
          jwId: 1,
          code: "clock",
          nameCn: "Clock semester",
          startDate: new Date("2026-02-01"),
          endDate: new Date("2026-07-01"),
        },
      });
      const course = await db.course.create({
        data: { jwId: 1, code: "clock", nameCn: "Clock course" },
      });
      const section = await db.section.create({
        data: {
          jwId: 1,
          code: "clock.01",
          courseId: course.id,
          semesterId: semester.id,
        },
      });
      const group = await db.scheduleGroup.create({
        data: {
          jwId: 1,
          sectionId: section.id,
          no: 1,
          limitCount: 1,
          stdCount: 1,
          actualPeriods: 2,
          isDefault: true,
        },
      });
      await db.schedule.create({
        data: {
          sectionId: section.id,
          scheduleGroupId: group.id,
          periods: 2,
          date: new Date(DEV_SEED_ANCHOR.date),
          weekday: 3,
          startTime: 1000,
          endTime: 1150,
          weekIndex: 1,
          startUnit: 3,
          endUnit: 4,
        },
      });
      await db.busCampus.createMany({
        data: [1, 2].map((id) => ({
          id,
          nameCn: `Clock campus ${id}`,
          latitude: 0,
          longitude: 0,
        })),
      });
      await db.busRoute.create({
        data: {
          id: 1,
          nameCn: "Clock route",
          stops: {
            create: [1, 2].map((campusId, stopOrder) => ({
              campusId,
              stopOrder,
            })),
          },
        },
      });
      await db.busScheduleVersion.create({
        data: {
          key: marker,
          title: "Clock timetable",
          checksum: marker,
          rawJson: {
            campuses: [1, 2].map((id) => ({
              id,
              name: `Clock campus ${id}`,
              latitude: 0,
              longitude: 0,
            })),
            routes: [
              {
                id: 1,
                campuses: [1, 2].map((id) => ({
                  id,
                  name: `Clock campus ${id}`,
                  latitude: 0,
                  longitude: 0,
                })),
              },
            ],
            weekday_routes: [],
            saturday_routes: [],
            sunday_routes: [],
            message: {
              message: "Clock timetable",
              url: "https://example.test/clock",
            },
          },
          trips: {
            create: {
              routeId: 1,
              dayType: "weekday",
              position: 0,
              stopTimes: ["09:00", "09:20"],
            },
          },
        },
      });
      return section;
    });
  }
  return {
    db,
    userId,
    get origin() {
      return origin;
    },
    get token() {
      return token;
    },
    objects,
    run: workflows.run,
    request,
    initialize,
    sign,
    close,
    arrangeClock,
    fetch: server.fetch,
    get publicJwksRequests() {
      return publicJwksRequests;
    },
    setOrigins(next: { public?: string; canonical?: string }) {
      publicOrigin = next.public ?? origin;
      canonicalOrigin = next.canonical ?? origin;
    },
    signJwt: (claims: Record<string, unknown>) =>
      request(() => auth.api.signJWT({ body: { payload: claims } })),
    post: (body: unknown, authorization?: string) =>
      server.fetch(`${origin}/api/mcp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...(authorization ? { authorization } : {}),
        },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
  };
}

export const mcpHttpTest = isolatedDatabaseTest.extend<{
  _mcpHttpResources: ReturnType<typeof ownMcpHttpFixture>;
  http: ReturnType<typeof ownMcpHttpFixture>;
}>({
  _mcpHttpResources: async ({ isolatedDatabase, onTestFinished }, use) => {
    const http = ownMcpHttpFixture(isolatedDatabase);
    try {
      // Register ownership before starting the listener, auth or database setup.
      await use(http);
    } finally {
      try {
        await http.close();
      } catch (error) {
        onTestFinished(() => {
          throw error;
        });
      }
    }
  },
  http: async ({ _mcpHttpResources }, use) => {
    await _mcpHttpResources.initialize();
    await use(_mcpHttpResources);
  },
});
