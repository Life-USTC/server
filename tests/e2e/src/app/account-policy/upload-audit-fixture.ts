import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { expect } from "@playwright/test";
import type {
  OAuthClient,
  OAuthConsent,
  Upload,
  User,
} from "@/generated/prisma-node/client";
import {
  OAUTH_CODE_RESPONSE_TYPE,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { authorizeDeviceBearer } from "../../../utils/oauth-device-bearer";
import {
  expectOAuthUsage,
  type OAuthUsageWindow,
} from "../../../utils/oauth-usage";
import { createUploadBucket } from "../../../utils/upload-bucket";
import { test as protocolTest } from "../api/mcp/_fixture";

type UploadAudit = {
  db: IsolatedWorker["database"]["owner"];
  user: User;
  client: OAuthClient;
  grant: OAuthConsent;
  cookie: { value: string };
  token: string;
  filename: string;
  contents: string;
  upload: Upload;
  mcp: Pick<Client, "callTool">;
};

export const test = protocolTest.extend<{
  uploadAuditRun: (
    work: (fixture: UploadAudit) => Promise<void>,
  ) => Promise<void>;
}>({
  uploadAuditRun: async (
    { isolatedWorker, request, page, calendarProtocolRun },
    use,
  ) => {
    await use((work) =>
      calendarProtocolRun(async (io) => {
        const db = isolatedWorker.database.owner;
        const uploadBucket = createUploadBucket(request, isolatedWorker.origin);
        const marker = `upload-audit-${crypto.randomUUID()}`;
        const scope = restWriteScope("workspace.upload");
        const filename = `${marker}-private.txt`;
        const contents = `${marker} private body`;
        const { user, client, upload } = await db.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              id: crypto.randomUUID(),
              name: "Private upload owner",
              emailVerified: true,
              username: `iw${crypto.randomUUID().replaceAll("-", "").slice(0, 17)}`,
              email: `${marker}@example.test`,
            },
          });
          const client = await tx.oAuthClient.create({
            data: {
              name: marker,
              clientId: crypto.randomUUID(),
              clientSecret: crypto.randomUUID(),
              redirectUris: [`${isolatedWorker.origin}/oauth-e2e/callback`],
              type: "public",
              tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
              disabled: false,
              scopes: [scope],
              grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
              responseTypes: [OAUTH_CODE_RESPONSE_TYPE],
              requirePKCE: true,
              metadata: { source: "e2e_fixture" },
            },
          });
          const upload = await tx.upload.create({
            data: {
              key: `uploads/${user.id}/${crypto.randomUUID()}`,
              userId: user.id,
              filename,
              contentType: "text/plain",
              size: Buffer.byteLength(contents),
            },
          });
          return { user, client, upload };
        });
        const actor = await isolatedWorker.createSession(user.id);
        await page.context().addCookies([actor.cookie]);
        await io.observeCalendar(user, [], { calendar: "absent" });
        await uploadBucket.put(upload.key, contents, {
          httpMetadata: { contentType: "text/plain" },
        });
        const sessions = await db.session.findMany();
        const authorizationStarted = Date.now();
        const token = await authorizeDeviceBearer(
          page.request,
          isolatedWorker.origin,
          client.clientId,
          scope,
          "/api/mcp",
        );
        const grant = await db.oAuthConsent.findUniqueOrThrow({
          where: {
            clientId_userId: { clientId: client.clientId, userId: user.id },
          },
        });
        const authorizationFinished = Date.now();
        const sdk = await io.mcp(
          { name: "upload-audit", version: "1.0.0" },
          token,
        );
        const windows: OAuthUsageWindow[] = [];
        await work({
          db,
          user,
          client,
          grant,
          cookie: actor.cookie,
          token,
          filename,
          contents,
          upload,
          mcp: {
            async callTool(...args) {
              const start = Date.now();
              const result = await sdk.callTool(...args);
              windows.push({
                start,
                end: Date.now(),
                operation: windows.length === 0 ? "write error" : "write",
              });
              return result;
            },
          },
        });
        return {
          async verifyTransport({ effects, sdkRequests }) {
            expect(
              sdkRequests
                .map(({ method, rpc }) => `${method} ${rpc ?? "stream"}`)
                .sort(),
            ).toEqual([
              "GET stream",
              "POST initialize",
              "POST notifications/initialized",
              "POST tools/call",
              "POST tools/call",
              "POST tools/call",
            ]);
            expect(
              sdkRequests
                .filter(({ rpc }) => rpc === "tools/call")
                .map(({ tool, status }) => [tool, status]),
            ).toEqual([
              ["workspace_upload_delete", 200],
              ["workspace_upload_delete", 200],
              ["workspace_upload_delete", 200],
            ]);
            for (const [path, method, statuses] of [
              ["/api/auth/oauth2/device-authorization", "POST", [200]],
              ["/oauth/device", "POST", [303]],
              ["/api/auth/oauth2/token", "POST", [200]],
              [
                `/api/workspace/uploads/${upload.id}/download`,
                "GET",
                [200, 404],
              ],
            ] as const)
              expect(
                effects.requests
                  .filter(
                    ({ value }) =>
                      value.path === path && value.method === method,
                  )
                  .map(({ result }) => result),
              ).toEqual(statuses);
          },
          async verifyState() {
            expect(await db.user.findMany()).toEqual([user]);
            const finalSessions = await db.session.findMany();
            expect(finalSessions).toEqual(
              sessions.map((session) => ({
                ...session,
                expires: expect.any(Date),
                updatedAt: expect.any(Date),
              })),
            );
            const expiryClock =
              finalSessions[0].expires.getTime() - 30 * 86400_000;
            for (const time of [
              expiryClock,
              finalSessions[0].updatedAt.getTime(),
            ]) {
              expect(time).toBeGreaterThanOrEqual(authorizationStarted);
              expect(time).toBeLessThanOrEqual(authorizationFinished);
            }
            expect(finalSessions[0].updatedAt.getTime()).toBeGreaterThanOrEqual(
              expiryClock,
            );
            expect(finalSessions[0].expires.getTime()).toBeGreaterThan(
              sessions[0].expires.getTime(),
            );
            expect(await db.oAuthClient.findMany()).toEqual([client]);
            expect(await db.oAuthConsent.findMany()).toEqual([grant]);
            expect(grant).toMatchObject({
              userId: user.id,
              clientId: client.clientId,
              scopes: [scope],
              resources: [`${isolatedWorker.origin}/api/mcp`],
              requestedUserInfoClaims: [],
            });
            expect(await db.upload.findMany()).toEqual([]);
            expect(await db.uploadPending.findMany()).toEqual([]);
            expect(await uploadBucket.head(upload.key)).toBeNull();
            expect(
              await uploadBucket.list({ prefix: `uploads/${user.id}/` }),
            ).toEqual({ objects: [], truncated: false });
            const events = await db.auditLog.findMany({
              select: {
                action: true,
                userId: true,
                subjectUserId: true,
                targetId: true,
                targetType: true,
                channel: true,
                outcome: true,
                oauthClientId: true,
                oauthGrantId: true,
                sessionId: true,
                metadata: true,
              },
            });
            expect(events).toEqual([
              {
                action: "upload_delete",
                userId: user.id,
                subjectUserId: user.id,
                targetId: upload.id,
                targetType: "upload",
                channel: "mcp",
                outcome: "success",
                oauthClientId: client.clientId,
                oauthGrantId: grant.grantId,
                sessionId: null,
                metadata: { size: upload.size, source: "mcp" },
              },
            ]);
            for (const secret of [
              filename,
              contents,
              upload.key,
              actor.cookie.value,
              token,
              user.name,
              user.email,
            ])
              expect(JSON.stringify(events)).not.toContain(secret);
            expect(await db.oAuthRefreshToken.count()).toBe(0);
            expect(await db.oAuthAccessToken.count()).toBe(0);
            expect(await db.deviceCode.count()).toBe(0);
            expectOAuthUsage(
              await db.oAuthGrantUsageDaily.findMany({
                orderBy: { day: "asc" },
              }),
              {
                dimensions: {
                  userId: user.id,
                  clientId: client.clientId,
                  grantId: grant.grantId,
                  feature: "workspace.upload",
                  channel: "mcp",
                },
                counts: [0, 3, 1],
                windows,
              },
            );
          },
        };
      }),
    );
  },
});
