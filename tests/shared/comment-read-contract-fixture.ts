import { makeSignature } from "better-auth/crypto";
import { getAdminModerationPage as readAdminPage } from "@/features/admin/server/admin-moderation-page-data";
import { getAdminCommentsRoute as readAdminComments } from "@/lib/api/routes/admin-comments-list-route";
import { getAdminDescriptionsRoute as readAdminDescriptions } from "@/lib/api/routes/admin-descriptions";
import { getCommentsRoute as readComments } from "@/lib/api/routes/comments-list-route";
import { getCommentRepliesRoute as readCommentReplies } from "@/lib/api/routes/comments-replies-route";
import { getCommentRoute as readComment } from "@/lib/api/routes/comments-thread-route";
import { getBetterAuthInstance } from "@/lib/auth/core";
import {
  type McpHarness,
  ownAnonymousMcpHarness,
  ownMcpHarness,
} from "../integration/mcp/_harness/client";
import { nodeProtocolTest } from "./node-protocol-fixture";

type OwnedMcp = ReturnType<typeof ownMcpHarness>;

export const commentReadTest = nodeProtocolTest
  .extend<{
    readSdk: { own(userId: string | null): OwnedMcp };
  }>({
    readSdk: async ({ protocolRuntime }, use) => {
      const sessions: OwnedMcp[] = [];
      let closed = false;
      const failures: unknown[] = [];
      try {
        // Register ownership before dependent state setup can open a transport.
        await use({
          own(userId) {
            if (closed) throw new Error("Comment reader SDK owner is closed");
            const runtime = { run: protocolRuntime.request };
            const owned =
              userId === null
                ? ownAnonymousMcpHarness(runtime)
                : ownMcpHarness(userId, undefined, runtime);
            sessions.push(owned);
            return owned;
          },
        });
      } catch (error) {
        failures.push(error);
      } finally {
        closed = true;
        const results = await Promise.allSettled(
          sessions.map(({ client }) => client.close()),
        );
        results.push(...(await Promise.allSettled([protocolRuntime.drain()])));
        failures.push(
          ...results.flatMap((result) =>
            result.status === "rejected" ? [result.reason] : [],
          ),
        );
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length)
        throw new AggregateError(
          failures,
          "Comment reader SDK lifecycle failed",
        );
    },
  })
  .extend(
    "reader",
    async ({ isolatedDatabase: { owner: db }, protocolRuntime, readSdk }) =>
      protocolRuntime.run(async () => {
        const marker = crypto.randomUUID();
        const origin = "http://localhost:3000";
        const users = ["owner", "other", "admin"].map(
          (role) => `${role}-${marker}`,
        );
        const [owner, other, admin] = users;
        const {
          tokens,
          teacherId,
          rootId,
          rootIds,
          hiddenId,
          deletedId,
          loginId,
        } = await db.$transaction(async (tx) => {
          const tokens = new Map<string, string>();
          const rootIds: string[] = [];
          for (const id of users) {
            await tx.user.create({
              data: {
                id,
                email: `${id}@example.test`,
                name: id,
                isAdmin: id === admin,
              },
            });
            const token = crypto.randomUUID();
            await tx.session.create({
              data: {
                userId: id,
                sessionToken: token,
                expires: new Date(Date.now() + 3600000),
              },
            });
            tokens.set(id, token);
          }
          const teacherId = (
            await tx.teacher.create({
              data: {
                nameCn: marker,
                jwId: -Math.floor(Math.random() * 1e9) - 1,
              },
            })
          ).id;
          for (let index = 0; index < 3; index++)
            rootIds.push(
              (
                await tx.comment.create({
                  data: {
                    teacherId,
                    userId: owner,
                    body: `${marker} public-${index} **bold**`,
                    isAnonymous: index === 0,
                    createdAt: new Date(Date.now() - 3000 + index * 1000),
                  },
                })
              ).id,
            );
          const rootId = rootIds[0];
          for (let index = 0; index < 13; index++)
            await tx.comment.create({
              data: {
                teacherId,
                userId: owner,
                body: `${marker} reply-${index}`,
                parentId: rootId,
                rootId,
              },
            });
          const hiddenId = (
            await tx.comment.create({
              data: {
                teacherId,
                userId: other,
                body: `${marker} hidden`,
                status: "softbanned",
              },
            })
          ).id;
          const deletedId = (
            await tx.comment.create({
              data: {
                teacherId,
                userId: owner,
                body: `${marker} deleted`,
                status: "deleted",
              },
            })
          ).id;
          const loginId = (
            await tx.comment.create({
              data: {
                teacherId,
                userId: owner,
                body: `${marker} login`,
                visibility: "logged_in_only",
              },
            })
          ).id;
          const upload = await tx.upload.create({
            data: {
              userId: owner,
              key: marker,
              filename: "contract.txt",
              size: 12,
            },
          });
          await tx.commentAttachment.create({
            data: { commentId: rootId, uploadId: upload.id },
          });
          await tx.commentReaction.create({
            data: { commentId: rootId, userId: owner, type: "heart" },
          });
          await tx.description.create({
            data: {
              teacherId,
              content: `${marker} description one`,
              lastEditedById: owner,
              lastEditedAt: new Date(),
            },
          });
          const teacher2 = await tx.teacher.create({
            data: {
              nameCn: marker,
              jwId: -Math.floor(Math.random() * 1e9) - 1,
            },
          });
          await tx.description.create({
            data: {
              teacherId: teacher2.id,
              content: `${marker} description two`,
              lastEditedById: owner,
              lastEditedAt: new Date(),
            },
          });
          return {
            tokens,
            teacherId,
            rootId,
            rootIds,
            hiddenId,
            deletedId,
            loginId,
          };
        });
        const cookies = new Map<string, string>();
        const context = await getBetterAuthInstance().$context;
        for (const [id, token] of tokens) {
          cookies.set(
            id,
            `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`,
          );
        }
        const clients = new Map<string | null, McpHarness>();
        for (const userId of [...users, null]) {
          const owned = readSdk.own(userId);
          await owned.initialize();
          clients.set(userId, owned.client);
        }
        function request(path: string, userId: string | null = null) {
          return new Request(`${origin}${path}`, {
            headers: userId ? { cookie: cookies.get(userId) ?? "" } : {},
          });
        }
        function listPath(params = "") {
          return `/api/community/comments?targetType=teacher&teacherId=${teacherId}${params}`;
        }
        function mcp(userId: string | null) {
          const client = clients.get(userId);
          if (!client) throw new Error("Missing MCP fixture");
          return client;
        }
        // Only runtime admission is wrapped: the actual transport/page functions
        // still execute their own guards, input validation and serialization.
        const getCommentsRoute = (...args: Parameters<typeof readComments>) =>
          protocolRuntime.request(() => readComments(...args));
        const getAdminCommentsRoute = (
          ...args: Parameters<typeof readAdminComments>
        ) => protocolRuntime.request(() => readAdminComments(...args));
        const getAdminDescriptionsRoute = (
          ...args: Parameters<typeof readAdminDescriptions>
        ) => protocolRuntime.request(() => readAdminDescriptions(...args));
        const getCommentRepliesRoute = (
          ...args: Parameters<typeof readCommentReplies>
        ) => protocolRuntime.request(() => readCommentReplies(...args));
        const getCommentRoute = (...args: Parameters<typeof readComment>) =>
          protocolRuntime.request(() => readComment(...args));
        const getAdminModerationPage = (
          ...args: Parameters<typeof readAdminPage>
        ) => protocolRuntime.request(() => readAdminPage(...args));
        return {
          marker,
          origin,
          owner,
          other,
          admin,
          teacherId,
          rootId,
          rootIds,
          hiddenId,
          deletedId,
          loginId,
          request,
          listPath,
          mcp,
          getCommentsRoute,
          getAdminCommentsRoute,
          getAdminDescriptionsRoute,
          getCommentRepliesRoute,
          getCommentRoute,
          getAdminModerationPage,
        };
      }),
  );
