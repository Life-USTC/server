import { createHash } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import type { Semester } from "@/generated/prisma-node/client";
import { PUBLIC_OAUTH_SCOPES } from "@/lib/oauth/scope-registry";
import type { CalendarProtocolChecks } from "../../../../utils/calendar-protocol-lifecycle";
import type { IsolatedWorker } from "../../../../utils/isolated-worker";
import {
  expectOAuthUsage,
  type OAuthUsageWindow,
} from "../../../../utils/oauth-usage";
import type { OAuthOwner } from "./helpers";

type NativeRequest = readonly [method: string, path: string, status: number];
type Database = IsolatedWorker["database"]["owner"];
const hash = (token: string) =>
  createHash("sha256").update(token).digest("base64url");

/** Set up authentication inside the protocol's complete owned callback. */
export async function prepareProtocolAccount(
  page: Page,
  worker: IsolatedWorker,
) {
  const startedAt = Date.now();
  const actor = await worker.createActor();
  const now = new Date();
  await worker.database.owner.session.updateMany({
    where: { userId: actor.id },
    data: {
      expires: new Date(now.getTime() + 30 * 86_400_000),
      updatedAt: now,
    },
  });
  await page.context().addCookies([actor.cookie]);
  const users = await worker.database.owner.user.findMany();
  const sessions = await worker.database.owner.session.findMany();
  expect(users).toHaveLength(1);
  expect(users[0]).toMatchObject({ id: actor.id, calendarFeedToken: null });
  expect(sessions).toHaveLength(1);
  expect(sessions[0].userId).toBe(actor.id);
  const oauth: OAuthOwner & { user: (typeof users)[number] } = {
    worker,
    user: users[0],
    clientNames: [],
  };
  return { oauth, users, sessions, startedAt };
}

async function expectDomainEmpty(db: Database, semesters: Semester[] = []) {
  expect(await db.semester.findMany({ orderBy: { id: "asc" } })).toEqual(
    semesters,
  );
  for (const rows of await Promise.all([
    db.course.findMany(),
    db.section.findMany(),
    db.teacher.findMany(),
    db.description.findMany(),
    db.descriptionEdit.findMany(),
    db.comment.findMany(),
    db.commentReaction.findMany(),
    db.commentAttachment.findMany(),
    db.homework.findMany(),
    db.homeworkCompletion.findMany(),
    db.todo.findMany(),
    db.userSectionSubscription.findMany(),
    db.userSuspension.findMany(),
    db.upload.findMany(),
    db.uploadPending.findMany(),
    db.busUserPreference.findMany(),
    db.workspaceLinkPin.findMany(),
    db.catalogLinkClick.findMany(),
    db.deviceCode.findMany(),
    db.verificationToken.findMany(),
  ]))
    expect(rows).toEqual([]);
}

function observedProtocolRequests(
  effects: Parameters<CalendarProtocolChecks["verifyTransport"]>[0]["effects"],
) {
  return effects.requests
    .filter(
      ({ value }) =>
        value.path === "/api/mcp" || value.path === "/api/workspace/todos",
    )
    .map(({ value, result }) => [value.method, value.path, result]);
}
const sorted = (requests: readonly (readonly unknown[])[]) =>
  requests.map((request) => JSON.stringify(request)).sort();

export function anonymousProtocolChecks(
  worker: IsolatedWorker,
  requests: readonly NativeRequest[],
  semesters: Semester[] = [],
): CalendarProtocolChecks {
  const db = worker.database.owner;
  return {
    async verifyTransport({ effects, sdkRequests }) {
      expect(sdkRequests).toEqual([]);
      expect(
        effects.requests.map(({ value, result }) => [
          value.method,
          value.path,
          result,
        ]),
      ).toEqual(requests);
      expect(effects.messages).toEqual([]);
      expect(effects.purges).toEqual([]);
    },
    async verifyState() {
      await expectDomainEmpty(db, semesters);
      for (const rows of await Promise.all([
        db.user.findMany(),
        db.session.findMany(),
        db.auditLog.findMany(),
        db.oAuthClient.findMany(),
        db.oAuthConsent.findMany(),
        db.oAuthRefreshToken.findMany(),
        db.oAuthAccessToken.findMany(),
        db.oAuthGrantUsageDaily.findMany(),
      ]))
        expect(rows).toEqual([]);
    },
  };
}

type RefreshTokenExpectation = {
  token: string | undefined;
  scopes: readonly string[];
  authorization: number;
  rotated: boolean;
};
type AccessTokenExpectation = {
  token: string | undefined;
  refreshToken: string | undefined;
  scopes: readonly string[];
};

/** Independent case inputs describe consent, token lineage and expected traffic.
 * This only checks evidence; calendarProtocolRun owns every native operation. */
export function oauthProtocolChecks(
  account: Awaited<ReturnType<typeof prepareProtocolAccount>>,
  expected: {
    clientId: string;
    consentScopes: readonly (readonly string[])[];
    resources: string[];
    tokenRequests: number;
    requests: readonly NativeRequest[];
    refreshTokens: readonly RefreshTokenExpectation[];
    accessTokens: readonly AccessTokenExpectation[];
    todoRead?: OAuthUsageWindow;
  },
): CalendarProtocolChecks {
  const { oauth, users, sessions, startedAt } = account;
  const db = oauth.worker.database.owner;
  const completedAt = Date.now();
  return {
    async verifyTransport({ effects, sdkRequests }) {
      for (const [method, path, statuses] of [
        ["POST", "/api/auth/oauth2/register", [201]],
        [
          "GET",
          "/api/auth/oauth2/authorize",
          expected.consentScopes.map(() => 302),
        ],
        ["POST", "/oauth/authorize", expected.consentScopes.map(() => 200)],
        [
          "POST",
          "/api/auth/oauth2/token",
          Array.from({ length: expected.tokenRequests }, () => 200),
        ],
      ] as const) {
        expect(
          effects.requests
            .filter(
              ({ value }) => value.method === method && value.path === path,
            )
            .map(({ result }) => result),
        ).toEqual(statuses);
      }
      expect(sorted(observedProtocolRequests(effects))).toEqual(
        sorted(expected.requests),
      );
      const allowedWrites = [
        "/api/mcp",
        "/api/auth/oauth2/register",
        "/oauth/authorize",
        "/api/auth/oauth2/token",
      ];
      expect(
        effects.requests.filter(
          ({ value }) =>
            !["GET", "HEAD", "OPTIONS"].includes(value.method) &&
            !allowedWrites.includes(value.path),
        ),
      ).toEqual([]);
      if (expected.todoRead) {
        expect(
          sdkRequests
            .map(({ method, rpc, tool, status }) => [
              method,
              rpc ?? null,
              tool ?? null,
              status,
            ])
            .sort(),
        ).toEqual([
          ["GET", null, null, 405],
          ["POST", "initialize", null, 200],
          ["POST", "notifications/initialized", null, 202],
          ["POST", "tools/call", "workspace_todo_list", 200],
        ]);
      } else expect(sdkRequests).toEqual([]);
      expect(effects.messages).toEqual([]);
      expect(effects.purges).toEqual([]);
    },
    async verifyState() {
      await expectDomainEmpty(db);
      expect(await db.user.findMany()).toEqual(users);
      expect(await db.session.findMany()).toEqual(sessions);
      expect(oauth.clientNames).toHaveLength(1);
      expect(
        await db.oAuthClient.findMany({
          select: {
            clientId: true,
            name: true,
            userId: true,
            scopes: true,
            redirectUris: true,
            grantTypes: true,
            responseTypes: true,
            tokenEndpointAuthMethod: true,
            applicationType: true,
          },
        }),
      ).toEqual([
        {
          clientId: expected.clientId,
          name: oauth.clientNames[0],
          userId: null,
          // Dynamic registration stores the provider's declared capabilities.
          // Requested consent and issued token scopes remain case-specific.
          scopes: PUBLIC_OAUTH_SCOPES,
          redirectUris: [`${oauth.worker.origin}/e2e/oauth/callback`],
          grantTypes: ["authorization_code"],
          responseTypes: ["code"],
          tokenEndpointAuthMethod: "none",
          applicationType: "native",
        },
      ]);
      const consents = await db.oAuthConsent.findMany({
        select: {
          id: true,
          grantId: true,
          clientId: true,
          userId: true,
          scopes: true,
          resources: true,
          requestedUserInfoClaims: true,
        },
      });
      expect(consents).toEqual([
        {
          id: expect.any(String),
          grantId: expect.any(String),
          clientId: expected.clientId,
          userId: oauth.user.id,
          scopes: expected.consentScopes.at(-1),
          resources: expected.resources,
          requestedUserInfoClaims: [],
        },
      ]);
      const consent = consents[0];
      expect(consent.grantId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(
        await db.auditLog.findMany({
          orderBy: { action: "asc" },
          select: {
            action: true,
            outcome: true,
            channel: true,
            userId: true,
            subjectUserId: true,
            targetId: true,
            targetType: true,
            oauthClientId: true,
            oauthGrantId: true,
            sessionId: true,
            metadata: true,
          },
        }),
      ).toEqual(
        expected.consentScopes.map((scopes, index) => ({
          action:
            index === 0
              ? "oauth_authorization_grant"
              : "oauth_authorization_update",
          outcome: "success",
          channel: "web",
          userId: oauth.user.id,
          subjectUserId: oauth.user.id,
          targetId: index === 0 ? expected.clientId : consent.id,
          targetType: index === 0 ? "oauth_client" : "oauth_consent",
          oauthClientId: expected.clientId,
          oauthGrantId: consent.grantId,
          sessionId: sessions[0].id,
          metadata: {
            changedFields: ["resources", "scopes", "userinfoClaims"],
            resourceCount: expected.resources.length,
            scopeCount: scopes.length,
          },
        })),
      );
      const refreshRows = await db.oAuthRefreshToken.findMany();
      expect(refreshRows).toHaveLength(expected.refreshTokens.length);
      const authorizations = new Map<number, string>();
      for (const token of expected.refreshTokens) {
        if (typeof token.token !== "string")
          throw new Error("Expected issued refresh token");
        const row = refreshRows.find(
          (row) => row.token === hash(token.token as string),
        );
        expect(row).toMatchObject({
          clientId: expected.clientId,
          userId: oauth.user.id,
          sessionId: sessions[0].id,
          grantId: null,
          referenceId: consent.grantId,
          scopes: token.scopes,
          resources: expected.resources,
          requestedUserInfoClaims: [],
          confirmation: null,
          authorizationCodeId: expect.any(String),
          authTime: expect.any(Date),
          revoked: token.rotated ? expect.any(Date) : null,
          rotatedAt: token.rotated ? expect.any(Date) : null,
          rotationReplayResponse: token.rotated ? expect.any(String) : null,
          rotationReplayExpiresAt: token.rotated ? expect.any(Date) : null,
        });
        if (!row?.authorizationCodeId)
          throw new Error("Missing issued refresh lineage");
        expect(row.createdAt.getTime()).toBeGreaterThanOrEqual(
          startedAt - 1000,
        );
        expect(row.createdAt.getTime()).toBeLessThanOrEqual(completedAt);
        expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(
          30 * 86_400_000,
        );
        const existing = authorizations.get(token.authorization);
        if (existing) expect(row.authorizationCodeId).toBe(existing);
        else {
          expect([...authorizations.values()]).not.toContain(
            row.authorizationCodeId,
          );
          authorizations.set(token.authorization, row.authorizationCodeId);
        }
        if (token.rotated) {
          expect(row.revoked).toEqual(row.rotatedAt);
          expect(row.rotatedAt?.getTime()).toBeGreaterThanOrEqual(
            startedAt - 1000,
          );
          expect(row.rotatedAt?.getTime()).toBeLessThanOrEqual(completedAt);
          expect(
            (row.rotationReplayExpiresAt?.getTime() ?? 0) -
              (row.rotatedAt?.getTime() ?? 0),
          ).toBe(30_000);
        }
      }
      const accessRows = await db.oAuthAccessToken.findMany();
      expect(accessRows).toHaveLength(expected.accessTokens.length);
      for (const token of expected.accessTokens) {
        if (
          typeof token.token !== "string" ||
          typeof token.refreshToken !== "string"
        )
          throw new Error("Expected opaque access and refresh tokens");
        const refresh = refreshRows.find(
          (row) => row.token === hash(token.refreshToken as string),
        );
        expect(refresh).toBeDefined();
        const row = accessRows.find(
          (row) => row.token === hash(token.token as string),
        );
        expect(row).toMatchObject({
          clientId: expected.clientId,
          userId: oauth.user.id,
          sessionId: sessions[0].id,
          grantId: null,
          referenceId: consent.grantId,
          scopes: token.scopes,
          resources: expected.resources,
          requestedUserInfoClaims: [],
          confirmation: null,
          authorizationCodeId: refresh?.authorizationCodeId,
          refreshId: refresh?.id,
          revoked: null,
          createdAt: expect.any(Date),
          expiresAt: expect.any(Date),
        });
      }
      const usage = await db.oAuthGrantUsageDaily.findMany({
        orderBy: { day: "asc" },
      });
      if (expected.todoRead)
        expectOAuthUsage(usage, {
          dimensions: {
            userId: oauth.user.id,
            clientId: expected.clientId,
            grantId: consent.grantId,
            feature: "workspace.todo",
            channel: "mcp",
          },
          counts: [1, 0, 0],
          windows: [expected.todoRead],
        });
      else expect(usage).toEqual([]);
    },
  };
}
