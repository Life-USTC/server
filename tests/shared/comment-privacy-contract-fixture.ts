import { makeSignature } from "better-auth/crypto";
import { getAdminModerationPage as readAdminPage } from "@/features/admin/server/admin-moderation-page-data";
import { getAdminCommentsRoute as readAdminComments } from "@/lib/api/routes/admin-comments-list-route";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { nodeProtocolTest } from "./node-protocol-fixture";

// Actor capabilities, anonymous content and identity-reveal audit scope are all
// private to a case. No later test can inherit a reveal performed by this one.
export const commentPrivacyTest = nodeProtocolTest.extend(
  "privacy",
  async ({ isolatedDatabase: { owner: db }, protocolRuntime }) =>
    protocolRuntime.run(async () => {
      const origin = "http://localhost:3000";
      const marker = crypto.randomUUID();
      const { sectionId, users, rootId, replyId } = await db.$transaction(
        async (tx) => {
          const semester = await tx.semester.create({
            data: { jwId: 1, code: marker, nameCn: "Comment privacy semester" },
          });
          const course = await tx.course.create({
            data: { jwId: 1, code: marker, nameCn: "Comment privacy course" },
          });
          const section = await tx.section.create({
            data: {
              courseId: course.id,
              semesterId: semester.id,
              jwId: -Math.floor(Math.random() * 1_000_000_000) - 1,
              code: `[integration-test] ${marker}`,
            },
          });
          const sectionId = section.id;
          const users: { id: string; name: string; sessionToken: string }[] =
            [];
          for (const role of ["owner", "other", "admin", "suspended"]) {
            const user = await tx.user.create({
              data: {
                name: `PRIVATE-${role}-${marker}`,
                email: `${role}-${marker}@example.test`,
                image: `https://example.test/PRIVATE-${role}-${marker}.png`,
                isAdmin: role === "admin" || role === "suspended",
              },
            });
            const sessionToken = crypto.randomUUID();
            await tx.session.create({
              data: {
                sessionToken,
                userId: user.id,
                expires: new Date(Date.now() + 3_600_000),
              },
            });
            users.push({ id: user.id, name: user.name, sessionToken });
          }
          const [owner, , , suspended] = users;
          await tx.userSuspension.create({
            data: {
              userId: suspended.id,
              reason: "[integration-test] Suspended moderator",
            },
          });
          const root = await tx.comment.create({
            data: {
              body: `[integration-test] ${marker} root`,
              sectionId,
              userId: owner.id,
              isAnonymous: true,
              visibility: "public",
            },
          });
          const rootId = root.id;
          const reply = await tx.comment.create({
            data: {
              body: `[integration-test] ${marker} reply`,
              sectionId,
              userId: owner.id,
              isAnonymous: true,
              visibility: "public",
              parentId: rootId,
              rootId,
            },
          });
          return { sectionId, users, rootId, replyId: reply.id };
        },
      );
      const [ownerId, otherId, adminId, suspendedId] = users.map(
        (user) => user.id,
      );
      const identities = new Map(users.map((user) => [user.id, user.name]));
      const cookies = new Map<string, string>();
      const context = await getBetterAuthInstance().$context;
      for (const { id, sessionToken } of users) {
        cookies.set(
          id,
          `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${sessionToken}.${await makeSignature(sessionToken, context.secret)}`)}`,
        );
      }
      function request(path: string, userId?: string) {
        return new Request(`${origin}${path}`, {
          headers: userId ? { cookie: cookies.get(userId) ?? "" } : {},
        });
      }
      // These are the actual page/REST functions, including their own guards.
      const getAdminModerationPage = (
        ...args: Parameters<typeof readAdminPage>
      ) => protocolRuntime.request(() => readAdminPage(...args));
      const getAdminCommentsRoute = (
        ...args: Parameters<typeof readAdminComments>
      ) => protocolRuntime.request(() => readAdminComments(...args));
      return {
        db,
        origin,
        sectionId,
        ownerId,
        otherId,
        adminId,
        suspendedId,
        rootId,
        replyId,
        identities,
        request,
        getAdminModerationPage,
        getAdminCommentsRoute,
      };
    }),
);
