import { type APIRequestContext, expect } from "@playwright/test";
import { createUploadedFileViaApi } from "../../../utils/uploads";
import { test } from "./attachment-security-fixture";

test("cases.content-security.upload-attachment-download-1", {
  tag: "@Upload/REST",
}, async ({ page, attachmentSecurityRun }) => {
  await attachmentSecurityRun(async (f) => {
    const { marker, contents } = f;
    const upload = await createUploadedFileViaApi(page.request, {
      filename: `${marker}.txt`,
      contents,
    });
    const uploadId = upload.uploadId;
    f.ids.upload = uploadId;
    f.ids.key = upload.key;
    const url = `/api/workspace/uploads/${uploadId}/download`;
    const actors: Record<string, APIRequestContext> = f.actors;
    const observedUrls = new Set<string>();
    const statuses: Record<string, Record<string, number>> = {
      unattached: { owner: 200, viewer: 404, admin: 404, anonymous: 401 },
      public: { owner: 200, viewer: 200, admin: 200, anonymous: 401 },
      logged_in_only: { owner: 200, viewer: 200, admin: 200, anonymous: 401 },
      softbanned: { owner: 200, viewer: 404, admin: 200, anonymous: 401 },
      restored: { owner: 200, viewer: 200, admin: 200, anonymous: 401 },
      parent_deleted: { owner: 200, viewer: 404, admin: 404, anonymous: 401 },
      upload_deleted: { owner: 404, viewer: 404, admin: 404, anonymous: 401 },
    };
    const expectState = async (state: string) => {
      for (const [role, actor] of Object.entries(actors)) {
        const response = await actor.get(url, { maxRedirects: 0 });
        const observed = new URL(response.url());
        observedUrls.add(observed.pathname);
        expect(observed.pathname).toBe(url);
        expect(response.status(), `${state}/${role}`).toBe(
          statuses[state][role],
        );
        const body = await response.text();
        if (response.status() === 200) {
          expect(body).toBe(contents);
          expect(response.headers()["content-type"]).toContain("text/plain");
        } else expect(body).not.toContain(contents);
        const preview = await actor.get(`${url}?preview=1`, {
          maxRedirects: 0,
        });
        expect(new URL(preview.url()).searchParams.get("preview")).toBe("1");
        expect(preview.status()).toBe(response.status());
        if (preview.status() === 200) {
          expect(preview.headers()["content-type"]).toContain("text/html");
          expect(await preview.text()).toContain(
            `href="${new URL(url, preview.url()).href}"`,
          );
        } else expect(await preview.text()).not.toContain(contents);
      }
    };
    await expectState("unattached");
    const created = await page.request.post("/api/community/comments", {
      data: {
        targetType: "section",
        sectionJwId: f.section.jwId,
        body: marker,
        attachmentIds: [uploadId],
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    const { id: commentId } = await created.json();
    f.ids.comment = commentId;
    await expectState("public");
    const visibility = await page.request.patch(
      `/api/community/comments/${commentId}`,
      { data: { body: marker, visibility: "logged_in_only" } },
    );
    await visibility.body();
    expect(visibility.status()).toBe(200);
    await expectState("logged_in_only");
    const moderate = async (status: "active" | "softbanned") => {
      const response = await f.actors.admin.patch(
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
    await deletedComment.body();
    expect(deletedComment.status()).toBe(200);
    await expectState("parent_deleted");
    const deletedUpload = await page.request.delete(
      `/api/workspace/uploads/${uploadId}`,
    );
    expect(deletedUpload.status(), await deletedUpload.text()).toBe(200);
    await expectState("upload_deleted");
    expect([...observedUrls]).toEqual([url]);
    expect(
      await f.db.upload.findUnique({ where: { id: uploadId } }),
    ).toBeNull();
  });
});
