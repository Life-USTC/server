import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  type APIRequestContext,
  type APIResponse,
  expect,
} from "@playwright/test";
import {
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { authorizeDeviceBearer } from "../../../utils/oauth-device-bearer";
import {
  expectOAuthUsage,
  type OAuthUsageWindow,
} from "../../../utils/oauth-usage";
import { createUploadBucket } from "../../../utils/upload-bucket";
import { createUploadedFileViaApi } from "../../../utils/uploads";
import { test } from "../api/mcp/_fixture";
import { parseTextContent } from "../api/mcp/helpers";

type UploadRequest = Pick<
  APIRequestContext,
  "get" | "post" | "put" | "patch" | "delete"
>;
function uploadRequest(request: APIRequestContext): UploadRequest {
  const eof = async (operation: Promise<APIResponse>) => {
    const response = await operation;
    await response.body();
    return response;
  };
  return {
    get: (...args) => eof(request.get(...args)),
    post: (...args) => eof(request.post(...args)),
    put: (...args) => eof(request.put(...args)),
    patch: (...args) => eof(request.patch(...args)),
    delete: (...args) => eof(request.delete(...args)),
  };
}
async function createActors(
  db: IsolatedWorker["database"]["owner"],
  origin: string,
  scopes: string[] = [],
) {
  const marker = `upload-security-${crypto.randomUUID()}`;
  return db.$transaction(async (tx) => {
    const users = [];
    for (const role of ["owner", "other"])
      users.push(
        await tx.user.create({
          data: {
            id: crypto.randomUUID(),
            name: `Upload ${role}`,
            username: `us${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
            email: `${marker}-${role}@example.test`,
          },
        }),
      );
    const [owner, other] = users;
    if (!owner || !other) throw new Error("Missing upload actors");
    const clients = [];
    for (const scope of scopes)
      clients.push(
        await tx.oAuthClient.create({
          data: {
            name: marker,
            clientId: crypto.randomUUID(),
            clientSecret: crypto.randomUUID(),
            redirectUris: [`${origin}/oauth-e2e/callback`],
            type: "public",
            tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
            disabled: false,
            scopes: [scope],
            grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
            responseTypes: ["code"],
            requirePKCE: true,
            metadata: { source: "e2e_fixture" },
          },
        }),
      );
    return { owner, other, marker, clients };
  });
}

test("upload.permission-and-quota", { tag: "@Upload/REST" }, async ({
  page,
  request,
  isolatedWorker,
  calendarProtocolRun,
}) => {
  await calendarProtocolRun(async (io) => {
    const db = isolatedWorker.database.owner;
    const actors = await createActors(db, isolatedWorker.origin);
    const ownerSession = await isolatedWorker.createSession(actors.owner.id);
    const otherSession = await isolatedWorker.createSession(actors.other.id);
    const sessions = await db.session.findMany({ orderBy: { id: "asc" } });
    await page.context().addCookies([ownerSession.cookie]);
    const sessionRequest = uploadRequest(page.request);
    await io.observeCalendar(actors.owner, [], { calendar: "absent" });
    const bucket = createUploadBucket(request, isolatedWorker.origin);
    let completedId: string;
    const input = {
      filename: "quota-boundary.txt",
      contentType: "text/plain",
      size: 2,
    };
    const anonymous = await uploadRequest(io.request).post(
      "/api/workspace/uploads",
      {
        data: input,
      },
    );
    expect(anonymous.status()).toBe(401);
    const ownerAuthorizationStarted = Date.now();
    const initial = await sessionRequest.get("/api/workspace/uploads");
    expect(initial.status()).toBe(200);
    const ownerAuthorizationFinished = Date.now();
    const {
      meta: { quotaBytes, maxFileSizeBytes },
    } = (await initial.json()) as {
      meta: { quotaBytes: number; maxFileSizeBytes: number };
    };
    expect(quotaBytes).toBeGreaterThan(12);
    await db.$transaction(async (db) => {
      // Existing completed usage is ledger data. Keep each historical file within
      // the public file limit; the new boundary upload below transfers real bytes.
      let remaining = quotaBytes - 12;
      let index = 0;
      while (remaining > 0) {
        const size = Math.min(remaining, maxFileSizeBytes);
        await db.upload.create({
          data: {
            userId: actors.owner.id,
            key: `uploads/${actors.owner.id}/${actors.marker}-${index++}`,
            filename: "existing-owned-file.txt",
            contentType: "text/plain",
            size,
          },
        });
        remaining -= size;
      }
      for (const expired of [false, true]) {
        await db.uploadPending.create({
          data: {
            userId: actors.owner.id,
            key: `uploads/${actors.owner.id}/${actors.marker}-${expired ? "expired" : "live"}`,
            filename: "pending-file.txt",
            contentType: "text/plain",
            size: expired ? maxFileSizeBytes : 10,
            expiresAt: new Date(Date.now() + (expired ? -60_000 : 300_000)),
            attemptId: crypto.randomUUID(),
          },
        });
      }
    });
    const historical = await db.upload.findMany({ orderBy: { id: "asc" } });
    const usage = await sessionRequest.get("/api/workspace/uploads");
    expect((await usage.json()).meta.usedBytes).toBe(quotaBytes - 2);
    const liveKeys = () =>
      db.$transaction((db) =>
        db.uploadPending.findMany({
          where: { userId: actors.owner.id, expiresAt: { gt: new Date() } },
          select: { key: true, size: true },
          orderBy: { key: "asc" },
        }),
      );
    const before = await liveKeys();
    const exceeded = await sessionRequest.post("/api/workspace/uploads", {
      data: { ...input, size: 3 },
    });
    expect(exceeded.status()).toBe(400);
    expect(await exceeded.json()).toMatchObject({ error: "Quota exceeded" });
    expect(await liveKeys()).toEqual(before);

    const accepted = await sessionRequest.post("/api/workspace/uploads", {
      data: input,
    });
    expect(accepted.status()).toBe(200);
    const reservation = (await accepted.json()) as { key: string; url: string };
    expect(
      (await liveKeys()).reduce((sum, pending) => sum + pending.size, 0),
    ).toBe(12);
    const full = await sessionRequest.post("/api/workspace/uploads", {
      data: { ...input, size: 1 },
    });
    expect(full.status()).toBe(400);
    expect(await full.json()).toMatchObject({ error: "Quota exceeded" });
    expect(
      (await liveKeys()).reduce((sum, pending) => sum + pending.size, 0),
    ).toBe(12);

    const put = await sessionRequest.put(reservation.url, {
      data: Buffer.from("ok"),
      headers: { "content-type": "text/plain" },
    });
    expect(put.status(), await put.text()).toBe(200);
    const complete = await sessionRequest.post(
      "/api/workspace/uploads/complete",
      {
        data: {
          key: reservation.key,
          filename: input.filename,
          contentType: input.contentType,
        },
      },
    );
    expect(complete.status(), await complete.text()).toBe(200);
    const body = await complete.json();
    completedId = body.upload.id;
    expect(body).toMatchObject({
      usedBytes: quotaBytes,
      quotaBytes,
      upload: { size: 2 },
    });
    const download = await sessionRequest.get(
      `/api/workspace/uploads/${completedId}/download`,
    );
    expect(download.status()).toBe(200);
    expect(await download.text()).toBe("ok");
    await page.context().addCookies([otherSession.cookie]);
    const otherAuthorizationStarted = Date.now();
    const other = await sessionRequest.post("/api/workspace/uploads", {
      data: input,
    });
    expect(other.status()).toBe(200);
    expect((await other.json()).usedBytes).toBe(0);
    const otherAuthorizationFinished = Date.now();
    const otherReservation = await other.json();
    return {
      async verifyTransport({ effects, sdkRequests }) {
        expect(sdkRequests).toEqual([]);
        expect(
          effects.requests
            .filter(
              ({ value }) =>
                value.path === "/api/workspace/uploads" &&
                value.method === "POST",
            )
            .map(({ result }) => result),
        ).toEqual([401, 400, 200, 400, 200]);
        expect(
          effects.requests
            .filter(
              ({ value }) =>
                value.path === "/api/workspace/uploads/object" &&
                value.method === "PUT",
            )
            .map(({ result }) => result),
        ).toEqual([200]);
        expect(
          effects.requests
            .filter(
              ({ value }) =>
                value.path === "/api/workspace/uploads/complete" &&
                value.method === "POST",
            )
            .map(({ result }) => result),
        ).toEqual([200]);
      },
      async verifyState() {
        expect(await db.user.findMany({ orderBy: { id: "asc" } })).toEqual(
          [actors.owner, actors.other].sort((a, b) => a.id.localeCompare(b.id)),
        );
        const finalSessions = await db.session.findMany({
          orderBy: { id: "asc" },
        });
        expect(finalSessions).toEqual(
          sessions.map((session) => ({
            ...session,
            expires: expect.any(Date),
            updatedAt: expect.any(Date),
          })),
        );
        for (const session of finalSessions) {
          const [start, end] =
            session.userId === actors.owner.id
              ? [ownerAuthorizationStarted, ownerAuthorizationFinished]
              : [otherAuthorizationStarted, otherAuthorizationFinished];
          const expiryClock = session.expires.getTime() - 30 * 86400_000;
          for (const time of [expiryClock, session.updatedAt.getTime()]) {
            expect(time).toBeGreaterThanOrEqual(start);
            expect(time).toBeLessThanOrEqual(end);
          }
          expect(session.updatedAt.getTime()).toBeGreaterThanOrEqual(
            expiryClock,
          );
          const initial = sessions.find((initial) => initial.id === session.id);
          if (!initial) throw new Error("Unexpected upload session");
          expect(session.expires.getTime()).toBeGreaterThan(
            initial.expires.getTime(),
          );
        }
        expect(
          await db.upload.findMany({
            where: { id: { not: completedId } },
            orderBy: { id: "asc" },
          }),
        ).toEqual(historical);
        expect(historical.reduce((sum, upload) => sum + upload.size, 0)).toBe(
          quotaBytes - 12,
        );
        expect(
          await db.upload.findUniqueOrThrow({ where: { id: completedId } }),
        ).toMatchObject({
          userId: actors.owner.id,
          key: reservation.key,
          filename: input.filename,
          contentType: "text/plain",
          size: 2,
        });
        expect(
          await db.uploadPending.findMany({
            orderBy: { key: "asc" },
            select: {
              userId: true,
              key: true,
              filename: true,
              size: true,
              phase: true,
              leaseExpiresAt: true,
            },
          }),
        ).toEqual(
          [
            {
              userId: actors.owner.id,
              key: `uploads/${actors.owner.id}/${actors.marker}-live`,
              filename: "pending-file.txt",
              size: 10,
              phase: "reserved",
              leaseExpiresAt: null,
            },
            {
              userId: actors.other.id,
              key: otherReservation.key,
              filename: input.filename,
              size: 2,
              phase: "reserved",
              leaseExpiresAt: null,
            },
          ].sort((a, b) => a.key.localeCompare(b.key)),
        );
        expect(
          await bucket.list({ prefix: `uploads/${actors.owner.id}/` }),
        ).toEqual({ objects: [{ key: reservation.key }], truncated: false });
        expect(await bucket.head(reservation.key)).toMatchObject({
          size: 2,
          httpMetadata: { contentType: "text/plain" },
        });
        const object = await bucket.get(reservation.key);
        if (!object) throw new Error("Completed quota object is missing");
        expect(Buffer.from(object.body).toString()).toBe("ok");
        expect(
          await bucket.list({ prefix: `uploads/${actors.other.id}/` }),
        ).toEqual({ objects: [], truncated: false });
        expect(await db.auditLog.count()).toBe(0);
        expect(await db.oAuthClient.count()).toBe(0);
        expect(await db.oAuthConsent.count()).toBe(0);
        expect(await db.oAuthAccessToken.count()).toBe(0);
        expect(await db.oAuthRefreshToken.count()).toBe(0);
        expect(await db.oAuthGrantUsageDaily.count()).toBe(0);
        expect(await db.deviceCode.count()).toBe(0);
      },
    };
  });
});

for (const method of ["REST", "GraphQL", "MCP"] as const)
  test(`upload.write-auth-unsuspended through ${method}`, {
    tag: `@Upload/${method}`,
  }, async ({ page, request, isolatedWorker, calendarProtocolRun }) => {
    test.setTimeout(90_000);
    await calendarProtocolRun(async (io) => {
      const db = isolatedWorker.database.owner;
      const origin = isolatedWorker.origin;
      const writeScope = "workspace.upload:write";
      const readScope = "workspace.upload:read";
      const actors = await createActors(db, origin, [
        writeScope,
        writeScope,
        writeScope,
        readScope,
        readScope,
        readScope,
        writeScope,
      ]);
      const ownerSession = await isolatedWorker.createSession(actors.owner.id);
      const otherSession = await isolatedWorker.createSession(actors.other.id);
      await page.context().addCookies([ownerSession.cookie]);
      const sessionRequest = uploadRequest(page.request);
      const asOther = async <T>(work: () => Promise<T>) => {
        await page.context().addCookies([otherSession.cookie]);
        try {
          return await work();
        } finally {
          await page.context().addCookies([ownerSession.cookie]);
        }
      };
      await io.observeCalendar(actors.owner, [], { calendar: "absent" });
      const bucket = createUploadBucket(request, origin);
      const sessions = await db.session.findMany({ orderBy: { id: "asc" } });
      const authorizationStarted = Date.now();
      let issued = 0;
      const issueToken = async (
        resource: "/api/auth" | "/api/graphql" | "/api/mcp",
        scope: string,
      ) => {
        const client = actors.clients[issued++];
        return authorizeDeviceBearer(
          page.request,
          origin,
          client.clientId,
          scope,
          resource,
        );
      };
      const restToken = await issueToken("/api/auth", writeScope);
      const graphqlToken = await issueToken("/api/graphql", writeScope);
      const mcpToken = await issueToken("/api/mcp", writeScope);
      const restRead = await issueToken("/api/auth", readScope);
      const graphqlRead = await issueToken("/api/graphql", readScope);
      const mcpRead = await issueToken("/api/mcp", readScope);
      const otherMcpToken = await asOther(() =>
        issueToken("/api/mcp", writeScope),
      );
      const authorizationFinished = Date.now();
      const usages: OAuthUsageWindow[][] = Array.from({ length: 7 }, () => []);
      const connect = async (
        token: string,
        index: number,
        expectedForbiddenTools: readonly string[] = [],
      ): Promise<Pick<Client, "callTool">> => {
        const sdk = await io.mcp(
          { name: "upload-security", version: "1.0.0" },
          token,
          expectedForbiddenTools,
        );
        return {
          async callTool(...args) {
            const start = Date.now();
            const result = await sdk.callTool(...args);
            if (index !== 5) {
              const call = usages[index].length;
              usages[index].push({
                start,
                end: Date.now(),
                operation: (index === 2 ? call >= 2 && call < 6 : call < 3)
                  ? "write error"
                  : "write",
              });
            }
            return result;
          },
        };
      };
      const mcp = await connect(mcpToken, 2);
      const readMcp = await connect(mcpRead, 5, [
        "workspace_upload_rename",
        "workspace_upload_delete",
      ]);
      const otherMcp = await connect(otherMcpToken, 6);
      const actualUploadIds: string[] = [];
      const contents = "original owned object bytes";
      const uploaded = await createUploadedFileViaApi(page.request, {
        filename: "owned.txt",
        contents,
      });
      actualUploadIds.push(uploaded.uploadId);
      const reserveInput = {
        filename: "pending.txt",
        contentType: "text/plain",
        size: Buffer.byteLength(contents),
      };
      const reserved = await sessionRequest.post("/api/workspace/uploads", {
        data: reserveInput,
      });
      expect(reserved.status()).toBe(200);
      const pending = (await reserved.json()) as { key: string; url: string };
      expect(
        (
          await sessionRequest.put(pending.url, {
            data: Buffer.from(contents),
            headers: { "content-type": "text/plain" },
          })
        ).status(),
      ).toBe(200);
      const completionInput = {
        key: pending.key,
        filename: "pending.txt",
        contentType: "text/plain",
      };
      const renameInput = { id: uploaded.uploadId, filename: "renamed.txt" };
      const operations = [
        {
          name: "reserve",
          field: "uploadSessionCreate",
          id: "workspace.upload.session.create.v1",
          query:
            "mutation Run($input: CreateUploadSessionInput!) { uploadSessionCreate(input:$input) { key } }",
          variables: { input: reserveInput },
        },
        {
          name: "complete",
          field: "uploadSessionComplete",
          id: "workspace.upload.complete.v1",
          query:
            "mutation Run($input: CompleteUploadSessionInput!) { uploadSessionComplete(input:$input) { upload { id } } }",
          variables: { input: completionInput },
        },
        {
          name: "rename",
          field: "uploadRename",
          id: "workspace.upload.rename.v1",
          query:
            "mutation Run($id: ID!, $filename: String!) { uploadRename(id:$id,filename:$filename) { upload { id filename } } }",
          variables: renameInput,
        },
        {
          name: "delete",
          field: "uploadDelete",
          id: "workspace.upload.delete.v1",
          query:
            "mutation Run($id: ID!) { uploadDelete(id:$id) { id success } }",
          variables: { id: uploaded.uploadId },
        },
      ] as const;
      const bearer = (token: string) => ({
        authorization: `Bearer ${token}`,
        cookie: "",
        origin,
      });
      const sendRest = async (
        operation: string,
        actor: UploadRequest,
        headers: Record<string, string> = {},
      ) => {
        if (operation === "reserve")
          return actor.post("/api/workspace/uploads", {
            data: reserveInput,
            headers,
          });
        if (operation === "put")
          return actor.put(pending.url, {
            data: Buffer.from("attempted replacement bytes"),
            headers: { "content-type": "text/plain", ...headers },
          });
        if (operation === "complete")
          return actor.post("/api/workspace/uploads/complete", {
            data: completionInput,
            headers,
          });
        if (operation === "rename")
          return actor.patch(`/api/workspace/uploads/${uploaded.uploadId}`, {
            data: { filename: renameInput.filename },
            headers,
          });
        return actor.delete(`/api/workspace/uploads/${uploaded.uploadId}`, {
          headers,
        });
      };
      const rest = async (
        operation: string,
        actor: UploadRequest,
        headers: Record<string, string> = {},
      ) => {
        const start = Date.now();
        const response = await sendRest(operation, actor, headers);
        if (headers.authorization === `Bearer ${restToken}`)
          usages[0].push({
            start,
            end: Date.now(),
            operation: usages[0].length === 0 ? "write" : "write error",
          });
        return response;
      };
      const graphql = async (
        operation: (typeof operations)[number],
        actor: UploadRequest,
        headers: Record<string, string> = { origin },
      ) => {
        const start = Date.now();
        const response = await actor.post("/api/graphql", {
          headers,
          data: { query: operation.query, variables: operation.variables },
        });
        if (headers.authorization === `Bearer ${graphqlToken}`)
          usages[1].push({
            start,
            end: Date.now(),
            operation: usages[1].length === 0 ? "write" : "write error",
          });
        return response;
      };
      const registered = (
        client: Pick<Client, "callTool">,
        operation: (typeof operations)[number],
      ) =>
        client.callTool({
          name: "graphql_operation_run",
          arguments: {
            operationId: operation.id,
            variables: operation.variables,
            confirmed: true,
          },
        });
      const assertGraphqlDenied = async (
        response: Awaited<ReturnType<typeof graphql>>,
        status: number,
        code: string,
      ) => {
        expect(response.status(), await response.text()).toBe(status);
        const body = await response.json();
        expect(body.errors).toMatchObject([{ extensions: { code } }]);
        expect(
          body.data == null ||
            Object.values(body.data).every((value) => value == null),
        ).toBe(true);
      };
      // Each native case establishes its selected entry point's valid authority.
      if (method === "REST") {
        expect((await rest("rename", sessionRequest)).status()).toBe(200);
        expect(
          (await rest("rename", sessionRequest, bearer(restToken))).status(),
        ).toBe(200);
      } else if (method === "GraphQL") {
        const positiveGraphql = await graphql(
          operations[2],
          sessionRequest,
          bearer(graphqlToken),
        );
        expect(positiveGraphql.status()).toBe(200);
        expect((await positiveGraphql.json()).errors).toBeUndefined();
      } else {
        expect(
          parseTextContent(await registered(mcp, operations[2])),
        ).toMatchObject({ success: true });
        expect(
          parseTextContent(
            await mcp.callTool({
              name: "workspace_upload_rename",
              arguments: renameInput,
            }),
          ),
        ).toMatchObject({ success: true });
      }
      const snapshot = () =>
        db.$transaction(async (db) => ({
          uploads: await db.upload.findMany({
            where: { userId: actors.owner.id },
            orderBy: { id: "asc" },
          }),
          pending: await db.uploadPending.findMany({
            where: { userId: actors.owner.id },
            orderBy: { id: "asc" },
          }),
          deleteAudits: await db.auditLog.count({
            where: { userId: actors.owner.id, action: "upload_delete" },
          }),
        }));
      const before = await snapshot();
      if (method === "REST") {
        const readStart = Date.now();
        expect(
          (
            await sessionRequest.get("/api/workspace/uploads", {
              headers: bearer(restRead),
            })
          ).status(),
        ).toBe(200);
        usages[3].push({
          start: readStart,
          end: Date.now(),
          operation: "read",
        });
      }
      if (method === "MCP") {
        const wrongMcpAudience = await sessionRequest.post("/api/mcp", {
          headers: {
            ...bearer(restToken),
            accept: "application/json, text/event-stream",
          },
          data: {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2025-03-26",
              capabilities: {},
              clientInfo: { name: "upload-security", version: "1.0.0" },
            },
          },
        });
        expect(wrongMcpAudience.status()).toBe(401);
      }
      if (method === "REST")
        for (const operation of [
          "reserve",
          "put",
          "complete",
          "rename",
          "delete",
        ]) {
          for (const [headers, status] of [
            [{ cookie: "" }, 401],
            [bearer("invalid-upload-token"), 401],
            [bearer(restRead), 401],
            [bearer(graphqlToken), 401],
          ] as const) {
            const response = await rest(operation, sessionRequest, headers);
            expect(
              response.status(),
              `${operation}: ${await response.text()}`,
            ).toBe(status);
          }
          if (operation !== "reserve") {
            const response = await asOther(() =>
              rest(operation, sessionRequest),
            );
            expect(response.status()).toBe(
              operation === "rename" || operation === "delete" ? 404 : 403,
            );
          }
        }
      for (const operation of operations) {
        if (method === "GraphQL") {
          await assertGraphqlDenied(
            await graphql(operation, sessionRequest, { cookie: "" }),
            401,
            "UNAUTHENTICATED",
          );
          await assertGraphqlDenied(
            await graphql(operation, sessionRequest, bearer(restToken)),
            401,
            "UNAUTHENTICATED",
          );
          await assertGraphqlDenied(
            await graphql(operation, sessionRequest, bearer(graphqlRead)),
            403,
            "FORBIDDEN",
          );
        }
        if (method === "MCP") {
          const missingScope = await registered(readMcp, operation);
          expect(missingScope.isError).toBe(true);
          expect(JSON.stringify(missingScope)).toContain(writeScope);
        }
        if (operation.name !== "reserve") {
          const expected =
            operation.name === "complete" ? "FORBIDDEN" : "NOT_FOUND";
          if (method === "GraphQL")
            await assertGraphqlDenied(
              await asOther(() => graphql(operation, sessionRequest)),
              expected === "NOT_FOUND" ? 404 : 403,
              expected,
            );
          if (method === "MCP") {
            const denied = await registered(otherMcp, operation);
            expect(denied.isError).toBe(true);
            expect(parseTextContent(denied)).toMatchObject({
              success: false,
              errors: [{ extensions: { code: expected } }],
            });
          }
        }
      }
      if (method === "MCP")
        for (const name of [
          "workspace_upload_rename",
          "workspace_upload_delete",
        ]) {
          const denied = await otherMcp.callTool({
            name,
            arguments: renameInput,
          });
          expect(parseTextContent(denied)).toMatchObject({
            success: false,
            error: "not_found",
          });
          await expect(
            readMcp.callTool({ name, arguments: renameInput }),
          ).rejects.toMatchObject({
            code: 403,
            message: expect.stringContaining("insufficient_scope"),
          });
        }
      expect(await snapshot()).toEqual(before);
      await db.$transaction((db) =>
        db.userSuspension.create({
          data: { userId: actors.owner.id, reason: actors.marker },
        }),
      );
      if (method === "REST")
        for (const operation of [
          "reserve",
          "put",
          "complete",
          "rename",
          "delete",
        ]) {
          for (const headers of [{}, bearer(restToken)]) {
            const response = await rest(operation, sessionRequest, headers);
            expect(
              response.status(),
              `${operation}: ${await response.text()}`,
            ).toBe(403);
          }
        }
      for (const operation of operations) {
        if (method === "GraphQL")
          for (const headers of [{ origin }, bearer(graphqlToken)])
            await assertGraphqlDenied(
              await graphql(operation, sessionRequest, headers),
              403,
              "FORBIDDEN",
            );
        if (method === "MCP") {
          const denied = await registered(mcp, operation);
          expect(denied.isError).toBe(true);
          expect(parseTextContent(denied)).toMatchObject({
            success: false,
            errors: [{ extensions: { code: "FORBIDDEN" } }],
          });
        }
      }
      if (method === "MCP")
        for (const name of [
          "workspace_upload_rename",
          "workspace_upload_delete",
        ]) {
          expect(
            parseTextContent(
              await mcp.callTool({ name, arguments: renameInput }),
            ),
          ).toMatchObject({ success: false, error: "suspended" });
        }
      expect(await snapshot()).toEqual(before);
      await db.$transaction((db) =>
        db.userSuspension.deleteMany({ where: { userId: actors.owner.id } }),
      );
      const completed = await sessionRequest.post(
        "/api/workspace/uploads/complete",
        { data: completionInput },
      );
      expect(completed.status(), await completed.text()).toBe(200);
      actualUploadIds.push((await completed.json()).upload.id);
      for (const id of actualUploadIds) {
        const download = await sessionRequest.get(
          `/api/workspace/uploads/${id}/download`,
        );
        expect(download.status()).toBe(200);
        expect(await download.text()).toBe(contents);
      }
      return {
        async verifyTransport({ effects, sdkRequests }) {
          for (const [path, status] of [
            ["/api/auth/oauth2/device-authorization", 200],
            ["/oauth/device", 303],
            ["/api/auth/oauth2/token", 200],
          ] as const)
            expect(
              effects.requests
                .filter(
                  ({ value }) => value.path === path && value.method === "POST",
                )
                .map(({ result }) => result),
            ).toEqual(Array(7).fill(status));
          for (const [requestMethod, path, statuses] of [
            [
              "POST",
              "/api/workspace/uploads",
              method === "REST"
                ? [200, 200, 401, 401, 401, 401, 403, 403]
                : [200, 200],
            ],
            [
              "PUT",
              "/api/workspace/uploads/object",
              method === "REST"
                ? [200, 200, 401, 401, 401, 401, 403, 403, 403]
                : [200, 200],
            ],
            [
              "POST",
              "/api/workspace/uploads/complete",
              method === "REST"
                ? [200, 401, 401, 401, 401, 403, 403, 403, 200]
                : [200, 200],
            ],
            [
              "PATCH",
              `/api/workspace/uploads/${uploaded.uploadId}`,
              method === "REST"
                ? [200, 200, 401, 401, 401, 401, 404, 403, 403]
                : [],
            ],
            [
              "DELETE",
              `/api/workspace/uploads/${uploaded.uploadId}`,
              method === "REST" ? [401, 401, 401, 401, 404, 403, 403] : [],
            ],
            [
              "POST",
              "/api/graphql",
              method === "GraphQL"
                ? [
                    200,
                    401,
                    401,
                    403,
                    401,
                    401,
                    403,
                    403,
                    401,
                    401,
                    403,
                    404,
                    401,
                    401,
                    403,
                    404,
                    ...Array(8).fill(403),
                  ]
                : [],
            ],
            ["GET", "/api/workspace/uploads", method === "REST" ? [200] : []],
            [
              "GET",
              `/api/workspace/uploads/${uploaded.uploadId}/download`,
              [200],
            ],
            [
              "GET",
              `/api/workspace/uploads/${actualUploadIds[1]}/download`,
              [200],
            ],
          ] as const)
            expect(
              effects.requests
                .filter(
                  ({ value }) =>
                    value.method === requestMethod && value.path === path,
                )
                .map(({ result }) => result),
            ).toEqual(statuses);
          expect(
            sdkRequests.filter(({ rpc }) => rpc === "initialize"),
          ).toHaveLength(3);
          expect(
            sdkRequests.filter(
              ({ rpc }) => rpc === "notifications/initialized",
            ),
          ).toHaveLength(3);
          expect(
            sdkRequests.filter(({ method }) => method === "GET"),
          ).toHaveLength(3);
          expect(
            sdkRequests
              .filter(({ rpc }) => rpc === "tools/call")
              .map(({ tool, status }) => [tool, status]),
          ).toEqual(
            method === "MCP"
              ? [
                  ["graphql_operation_run", 200],
                  ["workspace_upload_rename", 200],
                  ["graphql_operation_run", 200],
                  ["graphql_operation_run", 200],
                  ["graphql_operation_run", 200],
                  ["graphql_operation_run", 200],
                  ["graphql_operation_run", 200],
                  ["graphql_operation_run", 200],
                  ["graphql_operation_run", 200],
                  ["workspace_upload_rename", 200],
                  ["workspace_upload_rename", 403],
                  ["workspace_upload_delete", 200],
                  ["workspace_upload_delete", 403],
                  ...Array.from({ length: 4 }, () => [
                    "graphql_operation_run",
                    200,
                  ]),
                  ["workspace_upload_rename", 200],
                  ["workspace_upload_delete", 200],
                ]
              : [],
          );
          expect(
            effects.requests
              .filter(
                ({ value }) =>
                  value.path === "/api/mcp" &&
                  value.method === "POST" &&
                  !value.requestId,
              )
              .map(({ result }) => result),
          ).toEqual(method === "MCP" ? [401] : []);
        },
        async verifyState() {
          expect(await db.user.findMany({ orderBy: { id: "asc" } })).toEqual(
            [actors.owner, actors.other].sort((a, b) =>
              a.id.localeCompare(b.id),
            ),
          );
          const finalSessions = await db.session.findMany({
            orderBy: { id: "asc" },
          });
          expect(finalSessions).toEqual(
            sessions.map((session) => ({
              ...session,
              expires: expect.any(Date),
              updatedAt: expect.any(Date),
            })),
          );
          for (const session of finalSessions) {
            const expiryClock = session.expires.getTime() - 30 * 86400_000;
            for (const time of [expiryClock, session.updatedAt.getTime()]) {
              expect(time).toBeGreaterThanOrEqual(authorizationStarted);
              expect(time).toBeLessThanOrEqual(authorizationFinished);
            }
            expect(session.updatedAt.getTime()).toBeGreaterThanOrEqual(
              expiryClock,
            );
            const initial = sessions.find(
              (initial) => initial.id === session.id,
            );
            if (!initial) throw new Error("Unexpected upload session");
            expect(session.expires.getTime()).toBeGreaterThan(
              initial.expires.getTime(),
            );
          }
          expect(await db.userSuspension.count()).toBe(0);
          expect(await db.uploadPending.count()).toBe(0);
          expect(
            await db.upload.findMany({
              orderBy: { id: "asc" },
              select: {
                id: true,
                userId: true,
                key: true,
                filename: true,
                contentType: true,
                size: true,
              },
            }),
          ).toEqual(
            [
              {
                id: uploaded.uploadId,
                userId: actors.owner.id,
                key: before.uploads[0].key,
                filename: "renamed.txt",
                contentType: "text/plain",
                size: Buffer.byteLength(contents),
              },
              {
                id: actualUploadIds[1],
                userId: actors.owner.id,
                key: pending.key,
                filename: "pending.txt",
                contentType: "text/plain",
                size: Buffer.byteLength(contents),
              },
            ].sort((a, b) => a.id.localeCompare(b.id)),
          );
          const expectedKeys = [before.uploads[0].key, pending.key].sort();
          expect(
            await bucket.list({ prefix: `uploads/${actors.owner.id}/` }),
          ).toEqual({
            objects: expectedKeys.map((key) => ({ key })),
            truncated: false,
          });
          for (const key of expectedKeys) {
            expect(await bucket.head(key)).toMatchObject({
              size: Buffer.byteLength(contents),
              httpMetadata: { contentType: "text/plain" },
            });
            const object = await bucket.get(key);
            if (!object) throw new Error("Authorized upload object is missing");
            expect(Buffer.from(object.body).toString()).toBe(contents);
          }
          expect(
            await bucket.list({ prefix: `uploads/${actors.other.id}/` }),
          ).toEqual({ objects: [], truncated: false });
          expect(await db.auditLog.count()).toBe(0);
          expect(
            await db.oAuthClient.findMany({ orderBy: { id: "asc" } }),
          ).toEqual(
            [...actors.clients].sort((a, b) => a.id.localeCompare(b.id)),
          );
          const grants = await db.oAuthConsent.findMany();
          expect(grants).toHaveLength(7);
          const usageRows = await db.oAuthGrantUsageDaily.findMany({
            orderBy: { day: "asc" },
          });
          const counts = [
            [0, 6, 5],
            [0, 5, 4],
            [0, 8, 4],
            [1, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
            [0, 5, 3],
          ] as const;
          for (const [index, client] of actors.clients.entries()) {
            const userId = index === 6 ? actors.other.id : actors.owner.id;
            const resourcePath = [
              "/api/auth",
              "/api/graphql",
              "/api/mcp",
              "/api/auth",
              "/api/graphql",
              "/api/mcp",
              "/api/mcp",
            ][index];
            const grant = grants.find(
              (grant) => grant.clientId === client.clientId,
            );
            if (!grant) throw new Error("Missing upload device grant");
            expect(grant).toMatchObject({
              userId,
              scopes: client.scopes,
              resources: [origin + resourcePath],
              requestedUserInfoClaims: [],
              grantId: expect.any(String),
            });
            expectOAuthUsage(
              usageRows.filter((row) => row.clientId === client.clientId),
              {
                dimensions: {
                  userId,
                  clientId: client.clientId,
                  grantId: grant.grantId,
                  feature: "workspace.upload",
                  channel:
                    index === 0 || index === 3
                      ? "rest"
                      : index === 1 || index === 4
                        ? "graphql"
                        : "mcp",
                },
                counts:
                  (method === "REST" && (index === 0 || index === 3)) ||
                  (method === "GraphQL" && index === 1) ||
                  (method === "MCP" && (index === 2 || index === 6))
                    ? counts[index]
                    : [0, 0, 0],
                windows: usages[index],
              },
            );
          }
          expect(
            usageRows.every((row) =>
              actors.clients.some((client) => client.clientId === row.clientId),
            ),
          ).toBe(true);
          expect(await db.oAuthAccessToken.count()).toBe(0);
          expect(await db.oAuthRefreshToken.count()).toBe(0);
          expect(await db.deviceCode.count()).toBe(0);
        },
      };
    });
  });
