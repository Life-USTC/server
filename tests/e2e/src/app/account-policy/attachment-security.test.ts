import { type APIRequestContext, expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { createUploadedFileViaApi } from "../../../utils/uploads";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

test("cases.content-security.upload-attachment-download-1", async ({
  page,
  browser,
  request,
}) => {
  const marker = `attachment-policy-${crypto.randomUUID()}`;
  const users = await withE2ePrisma(async (db) => {
    const created = [];
    for (const role of ["owner", "viewer", "admin"] as const) {
      created.push(
        await db.user.create({
          data: {
            name: `Attachment ${role}`,
            username: `${role}${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`,
            email: `${marker}-${role}@example.test`,
            isAdmin: role === "admin",
          },
        }),
      );
    }
    return created;
  });
  const [owner, viewer, admin] = users;
  if (!owner || !viewer || !admin) throw new Error("Missing attachment actors");
  const viewerContext = await browser.newContext({
    baseURL: PLAYWRIGHT_BASE_URL,
  });
  const adminContext = await browser.newContext({
    baseURL: PLAYWRIGHT_BASE_URL,
  });
  let uploadId: string | undefined;
  try {
    await page
      .context()
      .addCookies([await createSignedSessionCookie(owner.id)]);
    await viewerContext.addCookies([
      await createSignedSessionCookie(viewer.id),
    ]);
    await adminContext.addCookies([await createSignedSessionCookie(admin.id)]);
    const contents = `${marker}: exact private object bytes`;
    const upload = await createUploadedFileViaApi(page.request, {
      filename: `${marker}.txt`,
      contents,
    });
    uploadId = upload.uploadId;
    const url = `/api/workspace/uploads/${uploadId}/download`;
    const expectDownload = async (actor: APIRequestContext, status: number) => {
      const response = await actor.get(url, { maxRedirects: 0 });
      expect(response.status()).toBe(status);
      if (status === 200) {
        expect(await response.text()).toBe(contents);
        expect(response.headers()["content-type"]).toContain("text/plain");
      } else {
        expect(await response.text()).not.toContain(contents);
      }
      const preview = await actor.get(`${url}?preview=1`, { maxRedirects: 0 });
      expect(preview.status()).toBe(status);
      if (status !== 200) expect(await preview.text()).not.toContain(contents);
    };
    await expectDownload(page.request, 200);
    await expectDownload(viewerContext.request, 404);
    await expectDownload(adminContext.request, 404);
    await expectDownload(request, 401);
    const created = await page.request.post("/api/community/comments", {
      data: {
        targetType: "section",
        sectionJwId: DEV_SEED.section.jwId,
        body: marker,
        attachmentIds: [uploadId],
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    const { id: commentId } = await created.json();
    await expectDownload(viewerContext.request, 200);
    await expectDownload(request, 401);
    const visibility = await page.request.patch(
      `/api/community/comments/${commentId}`,
      { data: { body: marker, visibility: "logged_in_only" } },
    );
    expect(visibility.status()).toBe(200);
    await expectDownload(viewerContext.request, 200);
    await expectDownload(request, 401);
    const moderate = async (status: "active" | "softbanned") => {
      const response = await adminContext.request.patch(
        `/api/admin/comments/${commentId}`,
        { data: { status, moderationNote: marker } },
      );
      expect(response.status(), await response.text()).toBe(200);
    };
    await moderate("softbanned");
    await expectDownload(viewerContext.request, 404);
    await expectDownload(page.request, 200);
    await expectDownload(adminContext.request, 200);
    await moderate("active");
    await expectDownload(viewerContext.request, 200);
    const deletedComment = await page.request.delete(
      `/api/community/comments/${commentId}`,
    );
    expect(deletedComment.status()).toBe(200);
    await expectDownload(viewerContext.request, 404);
    await expectDownload(adminContext.request, 404);
    // The uploader retains their own upload independently of its deleted attachment parent.
    await expectDownload(page.request, 200);
    const deletedUpload = await page.request.delete(
      `/api/workspace/uploads/${uploadId}`,
    );
    expect(deletedUpload.status(), await deletedUpload.text()).toBe(200);
    await expectDownload(page.request, 404);
    await expectDownload(viewerContext.request, 404);
    expect(
      await withE2ePrisma((db) =>
        db.upload.findUnique({ where: { id: uploadId } }),
      ),
    ).toBeNull();
    uploadId = undefined;
  } finally {
    if (uploadId)
      await page.request.delete(`/api/workspace/uploads/${uploadId}`);
    await viewerContext.close();
    await adminContext.close();
    await withE2ePrisma(async (db) => {
      await db.comment.deleteMany({ where: { userId: owner.id } });
      await db.auditLog.deleteMany({
        where: {
          OR: [
            { userId: { in: users.map((user) => user.id) } },
            { subjectUserId: { in: users.map((user) => user.id) } },
          ],
        },
      });
      await db.user.deleteMany({
        where: { id: { in: users.map((user) => user.id) } },
      });
    });
  }
});
