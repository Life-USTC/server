import type { Page } from "@playwright/test";
import { withE2ePrisma } from "./e2e-db/prisma";
import { createUploadedFileViaApi } from "./uploads";
import { createSignedSessionCookie } from "./workspace-task-filters";

export const PRIORITY_AVATAR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1sAAAAASUVORK5CYII=";
export async function createCommunityPriorityFixture(page: Page) {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const daysAgo = (days: number) =>
    new Date(today.getTime() - days * 86_400_000);
  const f = await withE2ePrisma(async (db) => {
    const marker = crypto.randomUUID();
    const n = 1_600_000_000 + Math.floor(Math.random() * 100_000_000);
    const author = await db.user.create({
      data: {
        name: "Priority community author",
        username: `pc${marker.replaceAll("-", "").slice(0, 20)}`,
        email: `priority-community-${marker}@example.test`,
        emailVerified: true,
        image: PRIORITY_AVATAR,
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
    });
    const course = await db.course.create({
      data: {
        jwId: n,
        code: "COMMUNITY",
        nameCn: "社区优先级课程",
        nameEn: "Community priority course",
      },
    });
    const section = await db.section.create({
      data: { jwId: n + 1, courseId: course.id, code: "COMMUNITY.01" },
    });
    const comment = await db.comment.create({
      data: {
        userId: author.id,
        courseId: course.id,
        body: "Priority community comment",
        visibility: "logged_in_only",
        status: "softbanned",
        createdAt: daysAgo(3),
        updatedAt: daysAgo(2),
      },
    });
    await db.commentReaction.create({
      data: { userId: author.id, commentId: comment.id, type: "heart" },
    });
    const description = await db.description.create({
      data: {
        courseId: course.id,
        content: "Priority community description",
        lastEditedById: author.id,
        lastEditedAt: new Date("2026-02-05T00:00:00Z"),
        updatedAt: new Date("2026-02-07T00:00:00Z"),
      },
    });
    const edit = await db.descriptionEdit.create({
      data: {
        descriptionId: description.id,
        editorId: author.id,
        previousContent: "Earlier community description",
        nextContent: description.content,
        createdAt: new Date("2026-02-05T00:00:00Z"),
      },
    });
    const homework = await db.homework.create({
      data: {
        sectionId: section.id,
        createdById: author.id,
        title: "Community priority homework",
        createdAt: daysAgo(1),
      },
    });
    return { author, course, section, comment, description, edit, homework };
  });
  await page
    .context()
    .addCookies([await createSignedSessionCookie(f.author.id)]);
  const uploaded = await createUploadedFileViaApi(page.request, {
    filename: "community-material.txt",
    contents: "Community priority attachment",
  });
  const upload = await withE2ePrisma(async (db) => {
    const upload = await db.upload.update({
      where: { id: uploaded.uploadId },
      data: { createdAt: today },
    });
    await db.commentAttachment.create({
      data: { uploadId: upload.id, commentId: f.comment.id },
    });
    return upload;
  });
  return { ...f, upload };
}
export type CommunityPriorityFixture = Awaited<
  ReturnType<typeof createCommunityPriorityFixture>
>;
export async function cleanupCommunityPriorityFixture(
  page: Page,
  f: CommunityPriorityFixture,
) {
  await withE2ePrisma((db) =>
    db.userSuspension.deleteMany({ where: { userId: f.author.id } }),
  );
  const uploads = await withE2ePrisma((db) =>
    db.upload.findMany({
      where: { userId: f.author.id },
      select: { id: true },
    }),
  );
  for (const upload of uploads)
    await page.request.delete(`/api/workspace/uploads/${upload.id}`);
  await withE2ePrisma(async (db) => {
    await db.auditLog.deleteMany({
      where: { OR: [{ userId: f.author.id }, { subjectUserId: f.author.id }] },
    });
    await db.section.delete({ where: { id: f.section.id } });
    await db.course.delete({ where: { id: f.course.id } });
    await db.user.delete({ where: { id: f.author.id } });
  });
}
