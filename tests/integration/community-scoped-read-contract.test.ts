import { makeSignature } from "better-auth/crypto";
import { expect } from "vitest";
import { signResourceBoundOAuthAccessToken } from "@/features/oauth/server/device-token-issuer.server";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { getOAuthRestAudienceUrls } from "@/lib/oauth/resource-urls";
import { restStateTest } from "../shared/rest-state-contract-fixture";

const test = restStateTest.extend(
  "readers",
  async ({ rest: { db, origin, fetch }, protocolRuntime }) =>
    protocolRuntime.run(async () => {
      const clientId = `community-reader-${crypto.randomUUID()}`;
      const scopes = [
        "community.comment:read",
        "community.description:read",
        "community.section-homework:read",
        "workspace.todo:read",
      ];
      await db.oAuthClient.create({
        data: {
          clientId,
          name: "Scoped community reader",
          scopes,
          redirectUris: ["https://client.example/callback"],
        },
      });
      async function actor(isAdmin = false) {
        const user = await db.user.create({
          data: {
            isAdmin,
            name: isAdmin ? "Other reader" : "Comment owner",
            email: `${crypto.randomUUID()}@community-reader.test`,
          },
        });
        const sessionToken = crypto.randomUUID();
        await db.session.create({
          data: {
            userId: user.id,
            sessionToken,
            expires: new Date(Date.now() + 3600_000),
          },
        });
        const context = await getBetterAuthInstance().$context;
        const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${sessionToken}.${await makeSignature(sessionToken, context.secret)}`)}`;
        const consent = await db.oAuthConsent.create({
          data: { userId: user.id, clientId, scopes },
        });
        return { id: user.id, cookie, consent };
      }
      const owner = await actor();
      const other = await actor(true);
      async function bearer(
        actor: typeof owner,
        overrides: Partial<
          Parameters<typeof signResourceBoundOAuthAccessToken>[0]
        > = {},
      ) {
        const issuedAt = Math.floor(Date.now() / 1000);
        const token = await signResourceBoundOAuthAccessToken({
          clientId,
          userId: actor.id,
          grantId: actor.consent.grantId,
          scopes,
          resources: getOAuthRestAudienceUrls(),
          issuedAt,
          expiresAt: issuedAt + 300,
          ...overrides,
        });
        if (!token) throw new Error("Expected signed resource token");
        return `Bearer ${token}`;
      }
      async function read(path: string, headers: Record<string, string> = {}) {
        const response = await fetch(`${origin}${path}`, { headers });
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(response.status).toBe(200);
        return response.json();
      }
      async function rejectReads(paths: string[]) {
        const invalid = [
          "Bearer",
          "Bearer malformed",
          await bearer(owner, { scopes: ["workspace.todo:read"] }),
          await bearer(owner, {
            resources: ["https://client.example/api/mcp"],
          }),
          await bearer(owner, {
            expiresAt: Math.floor(Date.now() / 1000) - 120,
          }),
          await bearer(owner, { grantId: crypto.randomUUID() }),
        ];
        for (const path of paths) {
          for (const authorization of invalid) {
            const response = await fetch(`${origin}${path}`, {
              headers: { authorization, cookie: owner.cookie },
            });
            expect(response.status).toBe(401);
            expect(response.headers.get("cache-control")).toBe(
              "private, no-store",
            );
            expect(await response.json()).toEqual({ error: "Unauthorized" });
          }
        }
      }
      const section = await db.section.findFirstOrThrow();
      return { owner, other, bearer, read, rejectReads, section };
    }),
);

test(
  "comment.scoped-rest-viewer",
  { tags: ["@Comment/REST"] },
  async ({ rest: { db }, readers: r, protocolRuntime }) =>
    protocolRuntime.run(async () => {
      const shared = { sectionId: r.section.id, userId: r.owner.id };
      const root = await db.comment.create({
        data: { ...shared, body: "Public root" },
      });
      const login = await db.comment.create({
        data: { ...shared, body: "Members only", visibility: "logged_in_only" },
      });
      const hidden = await db.comment.create({
        data: {
          ...shared,
          body: "Owner-only moderation state",
          status: "softbanned",
        },
      });
      const anonymous = await db.comment.create({
        data: { ...shared, body: "Anonymous contribution", isAnonymous: true },
      });
      const upload = await db.upload.create({
        data: {
          userId: r.owner.id,
          key: `uploads/${r.owner.id}/${crypto.randomUUID()}`,
          filename: "course-notes.txt",
          size: 12,
          contentType: "text/plain",
        },
      });
      await db.commentAttachment.create({
        data: { commentId: anonymous.id, uploadId: upload.id },
      });
      await db.commentReaction.create({
        data: { commentId: root.id, userId: r.owner.id, type: "heart" },
      });
      await db.comment.createMany({
        data: Array.from({ length: 11 }, (_, index) => ({
          ...shared,
          body: `Private reply ${index}`,
          visibility: "logged_in_only" as const,
          rootId: root.id,
          parentId: root.id,
          createdAt: new Date(Date.UTC(2026, 9, 1, 0, index)),
        })),
      });
      const listPath = `/api/community/comments?targetType=section&sectionJwId=${r.section.jwId}`;
      const publicRead = await r.read(listPath);
      expect(publicRead.meta.viewer.isAuthenticated).toBe(false);
      expect(
        publicRead.data.map((node: { id: string }) => node.id).sort(),
      ).toEqual([root.id, anonymous.id].sort());
      expect(
        publicRead.data.find((node: { id: string }) => node.id === anonymous.id)
          .attachments,
      ).toEqual([]);

      const ownerToken = await r.bearer(r.owner);
      const ownerRead = await r.read(listPath, {
        authorization: ownerToken,
        cookie: r.other.cookie,
      });
      const cookieRead = await r.read(listPath, { cookie: r.owner.cookie });
      expect(ownerRead).toEqual(cookieRead);
      expect(ownerRead.meta.viewer).toMatchObject({
        userId: r.owner.id,
        isAuthenticated: true,
      });
      expect(
        ownerRead.data.map((node: { id: string }) => node.id).sort(),
      ).toEqual([root.id, anonymous.id, login.id, hidden.id].sort());
      const ownerRoot = ownerRead.data.find(
        (node: { id: string }) => node.id === root.id,
      );
      expect(ownerRoot).toMatchObject({
        canEdit: true,
        canReply: true,
        reactions: [{ type: "heart", count: 1, viewerHasReacted: true }],
      });
      expect(ownerRoot.replies).toHaveLength(10);
      const masked = ownerRead.data.find(
        (node: { id: string }) => node.id === anonymous.id,
      );
      expect(masked).toMatchObject({
        author: null,
        authorHidden: true,
        canEdit: true,
      });
      expect(masked.attachments).toEqual([
        expect.objectContaining({
          uploadId: upload.id,
          filename: "course-notes.txt",
        }),
      ]);
      const focusedPath = `/api/community/comments/${root.id}`;
      const focused = await r.read(focusedPath, { authorization: ownerToken });
      expect(focused.viewer.userId).toBe(r.owner.id);
      expect(focused.thread[0].canEdit).toBe(true);
      const repliesPath = `/api/community/comments/${root.id}/replies?cursor=${encodeURIComponent(ownerRoot.repliesNextCursor)}`;
      const replies = await r.read(repliesPath, { authorization: ownerToken });
      expect(replies.viewer.userId).toBe(r.owner.id);
      expect(
        replies.thread[0].replies.map((node: { body: string }) => node.body),
      ).toContain("Private reply 10");
      const adminRead = await r.read(listPath, {
        authorization: await r.bearer(r.other),
      });
      expect(
        adminRead.data.some((node: { id: string }) => node.id === hidden.id),
      ).toBe(false);
      expect(
        adminRead.data.find((node: { id: string }) => node.id === anonymous.id)
          .author,
      ).toBeNull();
      await r.rejectReads([listPath, focusedPath, repliesPath]);
    }),
);

test(
  "description.scoped-rest-viewer",
  { tags: ["@Description/REST"] },
  async ({ rest: { db }, readers: r, protocolRuntime }) =>
    protocolRuntime.run(async () => {
      const description = await db.description.create({
        data: {
          sectionId: r.section.id,
          content: "Shared **supplement**",
          lastEditedById: r.owner.id,
          lastEditedAt: new Date("2026-10-01T08:00:00Z"),
          edits: {
            create: {
              editorId: r.owner.id,
              previousContent: "Before",
              nextContent: "Shared **supplement**",
            },
          },
        },
      });
      await db.userSuspension.create({
        data: { userId: r.other.id, reason: "Current suspension" },
      });
      const path = `/api/community/descriptions?targetType=section&sectionJwId=${r.section.jwId}`;
      const publicRead = await r.read(path);
      expect(publicRead.viewer).toMatchObject({
        isAuthenticated: false,
        userId: null,
      });
      expect(publicRead.description).toMatchObject({
        id: description.id,
        content: "Shared **supplement**",
      });
      const ownerRead = await r.read(path, {
        authorization: await r.bearer(r.owner),
        cookie: r.other.cookie,
      });
      expect(ownerRead.viewer).toMatchObject({
        isAuthenticated: true,
        userId: r.owner.id,
        isSuspended: false,
      });
      expect(ownerRead.description).toEqual(publicRead.description);
      expect(ownerRead.history).toEqual(publicRead.history);
      expect(ownerRead.history[0]).toMatchObject({
        previousContent: "Before",
        nextContent: "Shared **supplement**",
        editor: { id: r.owner.id },
      });
      expect(ownerRead).toEqual(await r.read(path, { cookie: r.owner.cookie }));
      const suspended = await r.read(path, {
        authorization: await r.bearer(r.other),
      });
      expect(suspended.viewer).toMatchObject({
        userId: r.other.id,
        isAuthenticated: true,
        isSuspended: true,
        suspensionReason: "Current suspension",
      });
      await r.rejectReads([path]);
      expect(
        await db.descriptionEdit.count({
          where: { descriptionId: description.id },
        }),
      ).toBe(1);
    }),
);

test(
  "homework.scoped-rest-viewer",
  { tags: ["@Homework/REST"] },
  async ({ rest: { db }, readers: r, protocolRuntime }) =>
    protocolRuntime.run(async () => {
      const homework = await db.homework.create({
        data: {
          sectionId: r.section.id,
          title: "Shared assignment",
          createdById: r.owner.id,
        },
      });
      const ownerCompletion = new Date("2026-10-01T08:00:00Z");
      const otherCompletion = new Date("2026-10-02T08:00:00Z");
      await db.homeworkCompletion.createMany({
        data: [
          {
            userId: r.owner.id,
            homeworkId: homework.id,
            completedAt: ownerCompletion,
          },
          {
            userId: r.other.id,
            homeworkId: homework.id,
            completedAt: otherCompletion,
          },
        ],
      });
      const listPath = `/api/community/section-homeworks?sectionJwId=${r.section.jwId}`;
      const detailPath = `/api/community/section-homeworks/${homework.id}`;
      const publicRead = await r.read(listPath);
      expect(publicRead.meta.viewer).toMatchObject({
        userId: null,
        isAuthenticated: false,
      });
      expect(publicRead.data[0].completion).toBeNull();
      expect((await r.read(detailPath)).homework.completion).toBeNull();
      for (const [headers, actor, completedAt] of [
        [{ cookie: r.owner.cookie }, r.owner, "2026-10-01T16:00:00+08:00"],
        [
          { authorization: await r.bearer(r.owner), cookie: r.other.cookie },
          r.owner,
          "2026-10-01T16:00:00+08:00",
        ],
        [
          { authorization: await r.bearer(r.other), cookie: r.owner.cookie },
          r.other,
          "2026-10-02T16:00:00+08:00",
        ],
      ] as const) {
        const list = await r.read(listPath, headers);
        const detail = await r.read(detailPath, headers);
        expect(list.meta.viewer).toMatchObject({
          userId: actor.id,
          isAuthenticated: true,
        });
        expect(list.data[0]).toMatchObject({
          id: homework.id,
          completion: { completedAt },
        });
        expect(detail.homework.completion).toEqual(list.data[0].completion);
      }
      await r.rejectReads([listPath, detailPath]);
      expect(
        await db.homeworkCompletion.count({
          where: { homeworkId: homework.id },
        }),
      ).toBe(2);
    }),
);
