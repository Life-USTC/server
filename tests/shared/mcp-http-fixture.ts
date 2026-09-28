import { createServer } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { getRequest } from "@sveltejs/kit/node";
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
async function createMcpHttpFixture(database: IsolatedDatabase) {
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
  const handlers: Promise<void>[] = [];
  const requests: Promise<void>[] = [];
  const responses = new Set<Response>();
  let closing: Promise<void> | undefined;
  function run<T>(work: () => T | Promise<T>): Promise<T> {
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
  function fetchOwned(input: string | URL | Request, init?: RequestInit) {
    if (closing)
      return Promise.reject(new Error("MCP HTTP fixture is closing"));
    const operation = fetch(input, init).then((response) => {
      responses.add(response);
      return response;
    });
    requests.push(
      operation.then(
        () => undefined,
        () => undefined,
      ),
    );
    return operation;
  }
  const server = createServer((incoming, outgoing) => {
    const handling = (async () => {
      try {
        const request = await getRequest({ request: incoming, base: origin });
        const path = new URL(request.url).pathname;
        const response = await run(() => {
          if (path === "/api/auth/jwks") {
            publicJwksRequests++;
            return auth.handler(request);
          }
          if (path === "/api/workspace/uploads/object")
            return putUploadObjectRoute(request);
          if (/^\/api\/workspace\/uploads\/[^/]+\/download$/.test(path))
            return getUploadDownloadRoute(request, { id: path.split("/")[4] });
          return (
            {
              POST: mcpPostRoute,
              GET: mcpGetRoute,
              DELETE: mcpDeleteRoute,
              OPTIONS: mcpOptionsRoute,
            }[request.method] ?? (() => new Response(null, { status: 405 }))
          )(request);
        });
        // SvelteKit setResponse starts a detached body pump. Own the native
        // pipeline so EOF/cancellation has finished before database teardown.
        for (const [name, value] of response.headers)
          outgoing.setHeader(
            name,
            name === "set-cookie" ? response.headers.getSetCookie() : value,
          );
        outgoing.writeHead(response.status);
        if (response.body) {
          await pipeline(
            Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>),
            outgoing,
          );
        } else outgoing.end();
      } catch (error) {
        if (!outgoing.destroyed) {
          if (!outgoing.headersSent) outgoing.statusCode = 500;
          outgoing.end(String(error));
        }
      }
    })();
    handlers.push(handling);
    // Observe immediately, including when a failing test no longer awaits fetch.
    void handling.catch(() => undefined);
  });
  async function close() {
    closing ??= (async () => {
      // Accepted handlers can fetch JWKS from this same server. Keep it open
      // while they finish; cancel unread client bodies before awaiting streams.
      for (let i = 0; i < requests.length; i++) await requests[i];
      const outcomes = await Promise.allSettled(
        [...responses].map((response) =>
          response.body && !response.bodyUsed
            ? response.body.cancel()
            : undefined,
        ),
      );
      for (let i = 0; i < handlers.length; i++) await handlers[i];
      outcomes.push(
        ...(await Promise.allSettled(
          runtimes.map((runtime) => runtime.close()),
        )),
      );
      outcomes.push(
        ...(await Promise.allSettled([
          new Promise<void>((resolve, reject) => {
            if (!server.listening) return resolve();
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
          }),
        ])),
      );
      objects.clear();
      calendarMessages.length = 0;
      const failures = outcomes.flatMap((result) =>
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
    const signed = await run(() =>
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
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing HTTP address");
    origin = `http://127.0.0.1:${address.port}`;
    publicOrigin = origin;
    canonicalOrigin = origin;
    auth = await run(async () => {
      const instance = betterAuth(buildBetterAuthOptions());
      await instance.$context;
      return instance;
    });
    await db.user.create({
      data: { id: userId, email: `${userId}@example.test` },
    });
    await db.oAuthClient.create({
      data: {
        clientId,
        name: "MCP HTTP contract",
        scopes,
        redirectUris: ["https://example.test/callback"],
        consents: { create: { userId, grantId, scopes } },
      },
    });
    const token = await sign();
    async function arrangeClock() {
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
    }
    return {
      db,
      userId,
      origin,
      token,
      objects,
      run,
      sign,
      close,
      arrangeClock,
      fetch: fetchOwned,
      get publicJwksRequests() {
        return publicJwksRequests;
      },
      setOrigins(next: { public?: string; canonical?: string }) {
        publicOrigin = next.public ?? origin;
        canonicalOrigin = next.canonical ?? origin;
      },
      signJwt: (claims: Record<string, unknown>) =>
        run(() => auth.api.signJWT({ body: { payload: claims } })),
      post: (body: unknown, authorization?: string) =>
        fetchOwned(`${origin}/api/mcp`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            ...(authorization ? { authorization } : {}),
          },
          body: typeof body === "string" ? body : JSON.stringify(body),
        }),
    };
  } catch (error) {
    try {
      await close();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "MCP HTTP setup and cleanup failed",
      );
    }
    throw error;
  }
}

export const mcpHttpTest = isolatedDatabaseTest.extend<{
  http: Awaited<ReturnType<typeof createMcpHttpFixture>>;
}>({
  http: async ({ isolatedDatabase }, use) => {
    const http = await createMcpHttpFixture(isolatedDatabase);
    try {
      await use(http);
    } finally {
      await http.close();
    }
  },
});
