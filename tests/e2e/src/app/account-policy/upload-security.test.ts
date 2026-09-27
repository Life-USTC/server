import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { type APIRequestContext, expect, test } from "@playwright/test";
import {
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import {
  createOAuthClientFixture,
  deleteOAuthClientsByName,
  PLAYWRIGHT_BASE_URL,
} from "../../../utils/e2e-db";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { authorizeDeviceBearer } from "../../../utils/oauth-device-bearer";
import { createUploadedFileViaApi } from "../../../utils/uploads";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";
import { parseTextContent } from "../api/mcp/helpers";

async function createActors() {
  const marker = `upload-security-${crypto.randomUUID()}`;
  return withE2ePrisma(async (db) => {
    const users = [];
    for (const role of ["owner", "other"]) {
      users.push(
        await db.user.create({
          data: {
            name: `Upload ${role}`,
            username: `us${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
            email: `${marker}-${role}@example.test`,
          },
        }),
      );
    }
    const [owner, other] = users;
    if (!owner || !other) throw new Error("Missing upload actors");
    return { owner, other, marker };
  });
}

async function cleanupActors(actors: Awaited<ReturnType<typeof createActors>>) {
  const ids = [actors.owner.id, actors.other.id];
  await withE2ePrisma(async (db) => {
    await db.auditLog.deleteMany({
      where: { OR: [{ userId: { in: ids } }, { subjectUserId: { in: ids } }] },
    });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });
}

test("upload.permission-and-quota", async ({ page, browser, request }) => {
  const actors = await createActors();
  const otherContext = await browser.newContext({
    baseURL: PLAYWRIGHT_BASE_URL,
  });
  let completedId: string | undefined;
  try {
    await page
      .context()
      .addCookies([await createSignedSessionCookie(actors.owner.id)]);
    await otherContext.addCookies([
      await createSignedSessionCookie(actors.other.id),
    ]);
    const input = {
      filename: "quota-boundary.txt",
      contentType: "text/plain",
      size: 2,
    };
    const anonymous = await request.post("/api/workspace/uploads", {
      data: input,
    });
    expect(anonymous.status()).toBe(401);
    const initial = await page.request.get("/api/workspace/uploads");
    expect(initial.status()).toBe(200);
    const {
      meta: { quotaBytes, maxFileSizeBytes },
    } = (await initial.json()) as {
      meta: { quotaBytes: number; maxFileSizeBytes: number };
    };
    expect(quotaBytes).toBeGreaterThan(12);
    await withE2ePrisma(async (db) => {
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
    const usage = await page.request.get("/api/workspace/uploads");
    expect((await usage.json()).meta.usedBytes).toBe(quotaBytes - 2);
    const liveKeys = () =>
      withE2ePrisma((db) =>
        db.uploadPending.findMany({
          where: { userId: actors.owner.id, expiresAt: { gt: new Date() } },
          select: { key: true, size: true },
          orderBy: { key: "asc" },
        }),
      );
    const before = await liveKeys();
    const exceeded = await page.request.post("/api/workspace/uploads", {
      data: { ...input, size: 3 },
    });
    expect(exceeded.status()).toBe(400);
    expect(await exceeded.json()).toMatchObject({ error: "Quota exceeded" });
    expect(await liveKeys()).toEqual(before);

    const accepted = await page.request.post("/api/workspace/uploads", {
      data: input,
    });
    expect(accepted.status()).toBe(200);
    const reservation = (await accepted.json()) as { key: string; url: string };
    expect(
      (await liveKeys()).reduce((sum, pending) => sum + pending.size, 0),
    ).toBe(12);
    const full = await page.request.post("/api/workspace/uploads", {
      data: { ...input, size: 1 },
    });
    expect(full.status()).toBe(400);
    expect(await full.json()).toMatchObject({ error: "Quota exceeded" });
    expect(
      (await liveKeys()).reduce((sum, pending) => sum + pending.size, 0),
    ).toBe(12);

    const put = await page.request.put(reservation.url, {
      data: Buffer.from("ok"),
      headers: { "content-type": "text/plain" },
    });
    expect(put.status(), await put.text()).toBe(200);
    const complete = await page.request.post(
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
    const download = await page.request.get(
      `/api/workspace/uploads/${completedId}/download`,
    );
    expect(download.status()).toBe(200);
    expect(await download.text()).toBe("ok");
    const other = await otherContext.request.post("/api/workspace/uploads", {
      data: input,
    });
    expect(other.status()).toBe(200);
    expect((await other.json()).usedBytes).toBe(0);
  } finally {
    if (completedId)
      await page.request.delete(`/api/workspace/uploads/${completedId}`);
    await otherContext.close();
    await cleanupActors(actors);
  }
});

test("upload.write-auth-unsuspended", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const actors = await createActors();
  const otherContext = await browser.newContext({
    baseURL: PLAYWRIGHT_BASE_URL,
  });
  const mcpClients: Client[] = [];
  const actualUploadIds: string[] = [];
  let pendingCleanupKey: string | undefined;
  try {
    await page
      .context()
      .addCookies([await createSignedSessionCookie(actors.owner.id)]);
    await otherContext.addCookies([
      await createSignedSessionCookie(actors.other.id),
    ]);
    const issueToken = async (
      resource: "/api/auth" | "/api/graphql" | "/api/mcp",
      scope: string,
      actor = page.request,
    ) => {
      const client = await createOAuthClientFixture({
        name: actors.marker,
        scopes: [scope],
        grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
        tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
      });
      return authorizeDeviceBearer(actor, client.clientId, scope, resource);
    };
    const writeScope = "workspace.upload:write";
    const readScope = "workspace.upload:read";
    const restToken = await issueToken("/api/auth", writeScope);
    const graphqlToken = await issueToken("/api/graphql", writeScope);
    const mcpToken = await issueToken("/api/mcp", writeScope);
    const restRead = await issueToken("/api/auth", readScope);
    const graphqlRead = await issueToken("/api/graphql", readScope);
    const mcpRead = await issueToken("/api/mcp", readScope);
    const otherMcpToken = await issueToken(
      "/api/mcp",
      writeScope,
      otherContext.request,
    );
    const connect = async (token: string) => {
      const client = new Client({ name: "upload-security", version: "1.0.0" });
      mcpClients.push(client);
      await client.connect(
        new StreamableHTTPClientTransport(
          new URL(`${PLAYWRIGHT_BASE_URL}/api/mcp`),
          { requestInit: { headers: { authorization: `Bearer ${token}` } } },
        ),
      );
      return client;
    };
    const mcp = await connect(mcpToken);
    const readMcp = await connect(mcpRead);
    const otherMcp = await connect(otherMcpToken);
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
    const reserved = await page.request.post("/api/workspace/uploads", {
      data: reserveInput,
    });
    expect(reserved.status()).toBe(200);
    const pending = (await reserved.json()) as { key: string; url: string };
    pendingCleanupKey = pending.key;
    expect(
      (
        await page.request.put(pending.url, {
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
        query: "mutation Run($id: ID!) { uploadDelete(id:$id) { id success } }",
        variables: { id: uploaded.uploadId },
      },
    ] as const;
    const bearer = (token: string) => ({
      authorization: `Bearer ${token}`,
      cookie: "",
      origin: PLAYWRIGHT_BASE_URL,
    });
    const rest = async (
      operation: string,
      actor: APIRequestContext,
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
    const graphql = (
      operation: (typeof operations)[number],
      actor: APIRequestContext,
      headers: Record<string, string> = { origin: PLAYWRIGHT_BASE_URL },
    ) =>
      actor.post("/api/graphql", {
        headers,
        data: { query: operation.query, variables: operation.variables },
      });
    const registered = (
      client: Client,
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
    // Positive controls establish valid first-party, REST, GraphQL and MCP authority.
    expect((await rest("rename", page.request)).status()).toBe(200);
    expect(
      (await rest("rename", page.request, bearer(restToken))).status(),
    ).toBe(200);
    const positiveGraphql = await graphql(
      operations[2],
      page.request,
      bearer(graphqlToken),
    );
    expect(positiveGraphql.status()).toBe(200);
    expect((await positiveGraphql.json()).errors).toBeUndefined();
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
    const snapshot = () =>
      withE2ePrisma(async (db) => ({
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
    expect(
      (
        await page.request.get("/api/workspace/uploads", {
          headers: bearer(restRead),
        })
      ).status(),
    ).toBe(200);
    const wrongMcpAudience = await page.request.post("/api/mcp", {
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
        const response = await rest(operation, page.request, headers);
        expect(
          response.status(),
          `${operation}: ${await response.text()}`,
        ).toBe(status);
      }
      if (operation !== "reserve") {
        const response = await rest(operation, otherContext.request);
        expect(response.status()).toBe(
          operation === "rename" || operation === "delete" ? 404 : 403,
        );
      }
    }
    for (const operation of operations) {
      await assertGraphqlDenied(
        await graphql(operation, page.request, { cookie: "" }),
        401,
        "UNAUTHENTICATED",
      );
      await assertGraphqlDenied(
        await graphql(operation, page.request, bearer(restToken)),
        401,
        "UNAUTHENTICATED",
      );
      await assertGraphqlDenied(
        await graphql(operation, page.request, bearer(graphqlRead)),
        403,
        "FORBIDDEN",
      );
      const missingScope = await registered(readMcp, operation);
      expect(missingScope.isError).toBe(true);
      expect(JSON.stringify(missingScope)).toContain(writeScope);
      if (operation.name !== "reserve") {
        const expected =
          operation.name === "complete" ? "FORBIDDEN" : "NOT_FOUND";
        await assertGraphqlDenied(
          await graphql(operation, otherContext.request),
          expected === "NOT_FOUND" ? 404 : 403,
          expected,
        );
        const denied = await registered(otherMcp, operation);
        expect(denied.isError).toBe(true);
        expect(parseTextContent(denied)).toMatchObject({
          success: false,
          errors: [{ extensions: { code: expected } }],
        });
      }
    }
    for (const name of ["workspace_upload_rename", "workspace_upload_delete"]) {
      const denied = await otherMcp.callTool({ name, arguments: renameInput });
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
    await withE2ePrisma((db) =>
      db.userSuspension.create({
        data: { userId: actors.owner.id, reason: actors.marker },
      }),
    );
    for (const operation of [
      "reserve",
      "put",
      "complete",
      "rename",
      "delete",
    ]) {
      for (const headers of [{}, bearer(restToken)]) {
        const response = await rest(operation, page.request, headers);
        expect(
          response.status(),
          `${operation}: ${await response.text()}`,
        ).toBe(403);
      }
    }
    for (const operation of operations) {
      for (const headers of [
        { origin: PLAYWRIGHT_BASE_URL },
        bearer(graphqlToken),
      ]) {
        await assertGraphqlDenied(
          await graphql(operation, page.request, headers),
          403,
          "FORBIDDEN",
        );
      }
      const denied = await registered(mcp, operation);
      expect(denied.isError).toBe(true);
      expect(parseTextContent(denied)).toMatchObject({
        success: false,
        errors: [{ extensions: { code: "FORBIDDEN" } }],
      });
    }
    for (const name of ["workspace_upload_rename", "workspace_upload_delete"]) {
      expect(
        parseTextContent(await mcp.callTool({ name, arguments: renameInput })),
      ).toMatchObject({ success: false, error: "suspended" });
    }
    expect(await snapshot()).toEqual(before);
    await withE2ePrisma((db) =>
      db.userSuspension.deleteMany({ where: { userId: actors.owner.id } }),
    );
    const completed = await page.request.post(
      "/api/workspace/uploads/complete",
      { data: completionInput },
    );
    expect(completed.status(), await completed.text()).toBe(200);
    actualUploadIds.push((await completed.json()).upload.id);
    for (const id of actualUploadIds) {
      const download = await page.request.get(
        `/api/workspace/uploads/${id}/download`,
      );
      expect(download.status()).toBe(200);
      expect(await download.text()).toBe(contents);
    }
  } finally {
    await withE2ePrisma((db) =>
      db.userSuspension.deleteMany({ where: { userId: actors.owner.id } }),
    );
    if (pendingCleanupKey) {
      const completed = await page.request.post(
        "/api/workspace/uploads/complete",
        {
          data: {
            key: pendingCleanupKey,
            filename: "pending.txt",
            contentType: "text/plain",
          },
        },
      );
      if (completed.ok())
        actualUploadIds.push((await completed.json()).upload.id);
    }
    for (const id of new Set(actualUploadIds))
      await page.request.delete(`/api/workspace/uploads/${id}`);
    for (const client of mcpClients) await client.close();
    await otherContext.close();
    await deleteOAuthClientsByName(actors.marker);
    await cleanupActors(actors);
  }
});
