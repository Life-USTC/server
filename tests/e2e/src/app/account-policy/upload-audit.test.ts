import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, test } from "@playwright/test";
import {
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { restWriteScope } from "@/lib/oauth/scope-registry";
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

test("audit.action-upload-delete", async ({ page }) => {
  const marker = `upload-audit-${crypto.randomUUID()}`;
  const user = await withE2ePrisma((db) =>
    db.user.create({
      data: {
        name: "Private upload owner",
        username: `ua${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `${marker}@example.test`,
      },
    }),
  );
  const scope = restWriteScope("workspace.upload");
  const client = await createOAuthClientFixture({
    name: marker,
    scopes: [scope],
    grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
    tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
  });
  const mcp = new Client({ name: "upload-audit", version: "1.0.0" });
  const constraint = `upload_audit_${crypto.randomUUID().replaceAll("-", "")}`;
  let guarded = false;
  let uploadId: string | undefined;
  try {
    const cookie = await createSignedSessionCookie(user.id);
    await page.context().addCookies([cookie]);
    const token = await authorizeDeviceBearer(
      page.request,
      client.clientId,
      scope,
      "/api/mcp",
    );
    await mcp.connect(
      new StreamableHTTPClientTransport(
        new URL(`${PLAYWRIGHT_BASE_URL}/api/mcp`),
        { requestInit: { headers: { authorization: `Bearer ${token}` } } },
      ),
    );
    const filename = `${marker}-private.txt`;
    const contents = `${marker} private body`;
    const upload = await createUploadedFileViaApi(page.request, {
      filename,
      contents,
    });
    uploadId = upload.uploadId;
    expect(
      await (
        await page.request.get(`/api/workspace/uploads/${uploadId}/download`)
      ).text(),
    ).toBe(contents);
    const grant = await withE2ePrisma((db) =>
      db.oAuthConsent.findUniqueOrThrow({
        where: {
          clientId_userId: { clientId: client.clientId, userId: user.id },
        },
      }),
    );
    const quotedUser = user.id.replaceAll("'", "''");
    await withE2ePrisma((db) =>
      db.$executeRawUnsafe(
        `ALTER TABLE "AuditLog" ADD CONSTRAINT "${constraint}" CHECK ("userId" <> '${quotedUser}' OR action <> 'upload_delete') NOT VALID`,
      ),
    );
    guarded = true;
    const blocked = await mcp.callTool({
      name: "workspace_upload_delete",
      arguments: { id: uploadId },
    });
    expect(blocked.isError).toBe(true);
    // Storage deletion precedes the atomic metadata/audit transaction.
    expect(
      (
        await page.request.get(`/api/workspace/uploads/${uploadId}/download`)
      ).status(),
    ).toBe(404);
    expect(
      await withE2ePrisma((db) =>
        db.upload.findUnique({ where: { id: uploadId } }),
      ),
    ).toMatchObject({ id: uploadId, userId: user.id });
    expect(
      await withE2ePrisma((db) =>
        db.auditLog.count({
          where: { userId: user.id, action: "upload_delete" },
        }),
      ),
    ).toBe(0);
    await withE2ePrisma((db) =>
      db.$executeRawUnsafe(
        `ALTER TABLE "AuditLog" DROP CONSTRAINT "${constraint}"`,
      ),
    );
    guarded = false;
    const result = parseTextContent(
      await mcp.callTool({
        name: "workspace_upload_delete",
        arguments: { id: uploadId },
      }),
    );
    expect(result).toMatchObject({
      success: true,
      deletedId: uploadId,
      deletedSize: Buffer.byteLength(contents),
    });
    expect(
      await withE2ePrisma((db) =>
        db.upload.findUnique({ where: { id: uploadId } }),
      ),
    ).toBeNull();
    const events = await withE2ePrisma((db) =>
      db.auditLog.findMany({
        where: { userId: user.id, action: "upload_delete" },
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      userId: user.id,
      subjectUserId: user.id,
      targetId: uploadId,
      targetType: "upload",
      channel: "mcp",
      outcome: "success",
      oauthClientId: client.clientId,
      oauthGrantId: grant.grantId,
      metadata: { size: Buffer.byteLength(contents), source: "mcp" },
    });
    for (const secret of [
      filename,
      contents,
      upload.key,
      cookie.value,
      token,
      user.name,
      user.email,
    ])
      expect(JSON.stringify(events)).not.toContain(secret);
    const repeated = parseTextContent(
      await mcp.callTool({
        name: "workspace_upload_delete",
        arguments: { id: uploadId },
      }),
    );
    expect(repeated).toMatchObject({ success: false, error: "not_found" });
    expect(
      await withE2ePrisma((db) =>
        db.auditLog.count({
          where: { userId: user.id, action: "upload_delete" },
        }),
      ),
    ).toBe(1);
    uploadId = undefined;
  } finally {
    if (guarded)
      await withE2ePrisma((db) =>
        db.$executeRawUnsafe(
          `ALTER TABLE "AuditLog" DROP CONSTRAINT "${constraint}"`,
        ),
      );
    if (uploadId)
      await page.request.delete(`/api/workspace/uploads/${uploadId}`);
    await mcp.close();
    await withE2ePrisma((db) =>
      db.auditLog.deleteMany({ where: { userId: user.id } }),
    );
    await deleteOAuthClientsByName(marker);
    await withE2ePrisma((db) => db.user.delete({ where: { id: user.id } }));
  }
});
