import { type APIRequestContext, expect, test } from "@playwright/test";
import { semanticContract } from "../../../../shared/specifications/semantic-contract";
import { DEV_SEED } from "../../../utils/dev-seed";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { createUploadedFileViaApi } from "../../../utils/uploads";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

test("cases.content-security.upload-attachment-download-1", async ({
  page,
  browser,
  request,
}, info) => {
  const contract = await semanticContract(
    "cases.content-security.upload-attachment-download-1",
    "attachment_download_authority",
  );
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
    const actors: Record<string, APIRequestContext> = {
      owner: page.request,
      viewer: viewerContext.request,
      admin: adminContext.request,
      anonymous: request,
    };
    const observedUrls = new Set<string>();
    const expectState = async (state: string) => {
      for (const [role, actor] of Object.entries(actors)) {
        const response = await actor.get(url, { maxRedirects: 0 });
        const observed = new URL(response.url());
        observedUrls.add(observed.pathname);
        contract.equal("/route", {
          method: "GET",
          path: observed.pathname.replace(upload.uploadId, "{id}"),
        });
        contract.equal(`/states/${state}/${role}`, response.status());
        const body = await response.text();
        if (response.status() === 200) {
          contract.equal("/authorized_bytes_preserved", body === contents);
          expect(response.headers()["content-type"]).toContain("text/plain");
        } else
          contract.equal(
            "/denied_responses_hide_bytes",
            !body.includes(contents),
          );
        const preview = await actor.get(`${url}?preview=1`, {
          maxRedirects: 0,
        });
        contract.equal(
          "/preview_parameter",
          [...new URL(preview.url()).searchParams.keys()][0],
        );
        contract.equal(
          "/preview_matches_download",
          preview.status() === response.status(),
        );
        if (preview.status() === 200) {
          expect(preview.headers()["content-type"]).toContain("text/html");
          expect(await preview.text()).toContain(
            `href="${new URL(url, preview.url()).href}"`,
          );
        } else
          contract.equal(
            "/denied_responses_hide_bytes",
            !(await preview.text()).includes(contents),
          );
      }
    };
    await expectState("unattached");
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
    await expectState("public");
    const visibility = await page.request.patch(
      `/api/community/comments/${commentId}`,
      { data: { body: marker, visibility: "logged_in_only" } },
    );
    expect(visibility.status()).toBe(200);
    await expectState("logged_in_only");
    const moderate = async (status: "active" | "softbanned") => {
      const response = await adminContext.request.patch(
        `/api/admin/comments/${commentId}`,
        { data: { status, moderationNote: marker } },
      );
      expect(response.status(), await response.text()).toBe(200);
    };
    await moderate("softbanned");
    await expectState("softbanned");
    await moderate("active");
    await expectState("restored");
    const deletedComment = await page.request.delete(
      `/api/community/comments/${commentId}`,
    );
    expect(deletedComment.status()).toBe(200);
    await expectState("parent_deleted");
    const deletedUpload = await page.request.delete(
      `/api/workspace/uploads/${uploadId}`,
    );
    expect(deletedUpload.status(), await deletedUpload.text()).toBe(200);
    await expectState("upload_deleted");
    contract.equal("/same_url_across_states", observedUrls.size === 1);
    contract.recordPlaywright(info);
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
