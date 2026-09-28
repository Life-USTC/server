import { expect } from "@playwright/test";
import { parseTextContent } from "../api/mcp/helpers";
import { test } from "./upload-audit-fixture";

test("audit.action-upload-delete", async ({ page, uploadAudit }) => {
  const {
    db,
    user,
    client,
    grant,
    cookie,
    token,
    filename,
    contents,
    upload,
    mcp,
  } = uploadAudit;
  const uploadId = upload.id;
  const constraint = `upload_audit_${crypto.randomUUID().replaceAll("-", "")}`;

  expect(
    await (
      await page.request.get(`/api/workspace/uploads/${uploadId}/download`)
    ).text(),
  ).toBe(contents);

  const quotedUser = user.id.replaceAll("'", "''");
  await db.$executeRawUnsafe(
    `ALTER TABLE "AuditLog" ADD CONSTRAINT "${constraint}" CHECK ("userId" <> '${quotedUser}' OR action <> 'upload_delete') NOT VALID`,
  );

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
  expect(await db.upload.findUnique({ where: { id: uploadId } })).toMatchObject(
    { id: uploadId, userId: user.id },
  );
  expect(
    await db.auditLog.count({
      where: { userId: user.id, action: "upload_delete" },
    }),
  ).toBe(0);
  await db.$executeRawUnsafe(
    `ALTER TABLE "AuditLog" DROP CONSTRAINT "${constraint}"`,
  );

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
  expect(await db.upload.findUnique({ where: { id: uploadId } })).toBeNull();
  const events = await db.auditLog.findMany({
    where: { userId: user.id, action: "upload_delete" },
  });
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
    await db.auditLog.count({
      where: { userId: user.id, action: "upload_delete" },
    }),
  ).toBe(1);
});
