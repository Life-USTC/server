import { expect } from "@playwright/test";
import type { TestPrismaClient } from "../../shared/prisma";

/** Public consumers must leave their independently authored catalog intact. */
export function publicIdentityState(db: TestPrismaClient) {
  return db.$transaction(async (tx) => ({
    users: await tx.user.findMany({ orderBy: { id: "asc" } }),
    courses: await tx.course.findMany({ orderBy: { id: "asc" } }),
    semesters: await tx.semester.findMany({ orderBy: { id: "asc" } }),
    teachers: await tx.teacher.findMany({ orderBy: { id: "asc" } }),
    sections: await tx.section.findMany({
      orderBy: { id: "asc" },
      include: { teachers: { orderBy: { id: "asc" } } },
    }),
    comments: await tx.comment.findMany({ orderBy: { id: "asc" } }),
    descriptions: await tx.description.findMany({ orderBy: { id: "asc" } }),
  }));
}

export async function expectPublicIdentityEffectsEmpty(db: TestPrismaClient) {
  for (const rows of await Promise.all([
    db.session.findMany(),
    db.auditLog.findMany(),
    db.descriptionEdit.findMany(),
    db.commentReaction.findMany(),
    db.commentAttachment.findMany(),
    db.userSectionSubscription.findMany(),
    db.homework.findMany(),
    db.todo.findMany(),
    db.upload.findMany(),
    db.uploadPending.findMany(),
    db.oAuthClient.findMany(),
    db.oAuthConsent.findMany(),
    db.oAuthGrantUsageDaily.findMany(),
    db.oAuthAccessToken.findMany(),
    db.oAuthRefreshToken.findMany(),
    db.deviceCode.findMany(),
  ]))
    expect(rows).toEqual([]);
}
