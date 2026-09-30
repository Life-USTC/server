import { isDeepStrictEqual } from "node:util";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { expect, type Page } from "@playwright/test";
import type {
  AuditLog,
  User,
} from "../../../../../../src/generated/prisma-node/client";
import { withBrowserWorkflow } from "../../../../utils/browser-workflow";
import {
  type CalendarBrowserWriteVerifier,
  type CalendarProtocol,
  type CalendarProtocolChecks,
  withCalendarProtocol,
} from "../../../../utils/calendar-protocol-lifecycle";
import {
  expectOAuthUsage,
  type OAuthUsageWindow,
} from "../../../../utils/oauth-usage";
import { test as workerTest } from "../../../../utils/owned-worker";
import {
  issueAccessToken,
  MCP_CLIENT_SCOPE,
  MCP_CLIENT_SCOPES,
  type OAuthOwner,
} from "./helpers";

type OAuth = OAuthOwner & { user: User };

/** Every authenticated scenario owns the real Worker, database, OAuth state,
 * queues and storage. A consumer requests only its own domain prerequisites. */
export const test = workerTest.extend<{
  oauthOwner: OAuthOwner;
  oauth: OAuth;
  calendarProtocolRun: (
    work: (io: CalendarProtocol) => Promise<CalendarProtocolChecks>,
    verifyBrowserWrite?: CalendarBrowserWriteVerifier,
  ) => Promise<void>;
  mcpRun: (
    plan: McpPlan,
    work: (io: McpScenario) => Promise<McpChecks>,
  ) => Promise<void>;
}>({
  oauthOwner: async ({ isolatedWorker, run }, use, testInfo) => {
    const owner: OAuthOwner = { worker: isolatedWorker, clientNames: [] };
    const errors: unknown[] = [];
    try {
      await use(owner);
    } catch (error) {
      errors.push(error);
    }
    try {
      await run(() =>
        testInfo.attach("oauth-owned-state", {
          body: JSON.stringify({
            database: isolatedWorker.database.name,
            clientNames: owner.clientNames,
          }),
          contentType: "application/json",
        }),
      );
    } catch (error) {
      errors.push(error);
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length)
      throw new AggregateError(errors, "OAuth owner and evidence failed");
  },
  oauth: async ({ oauthOwner, page, run }, use) => {
    const oauth = await run(async () => {
      const actor = await oauthOwner.worker.createActor();
      await page.context().addCookies([actor.cookie]);
      const user =
        await oauthOwner.worker.database.owner.user.findUniqueOrThrow({
          where: { id: actor.id },
        });
      return { ...oauthOwner, user };
    });
    await use(oauth);
  },
  calendarProtocolRun: async (
    { page, request, playwright, isolatedWorker, run },
    use,
    testInfo,
  ) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work, verifyBrowserWrite) =>
        workflow.run(() =>
          run(() =>
            withCalendarProtocol(
              {
                page,
                observer: request,
                isolatedWorker,
                createRequest: (headers) =>
                  playwright.request.newContext({
                    baseURL: isolatedWorker.origin,
                    extraHTTPHeaders: headers,
                  }),
                runBody: workflow.body,
                testInfo,
                verifyBrowserWrite,
              },
              work,
            ),
          ),
        ),
      );
    });
  },
  mcpRun: async ({ calendarProtocolRun, isolatedWorker, page }, use) => {
    await use((plan, work) =>
      calendarProtocolRun(async (io) => {
        return runMcpScenario(page, isolatedWorker, io, plan, work);
      }),
    );
  },
});

type McpPlan = {
  calls: readonly (
    | readonly [tool: string]
    | readonly [tool: string, feature: string, operation: "read" | "write"]
  )[];
  usage: readonly (readonly [feature: string, reads: number, writes: number])[];
  listTools?: true;
};
type McpScenario = {
  oauth: OAuth;
  mcp: Pick<Client, "callTool" | "listTools">;
  request: CalendarProtocol["request"];
  observeCalendar: (
    messages: Parameters<CalendarProtocol["observeCalendar"]>[1],
    options?: Parameters<CalendarProtocol["observeCalendar"]>[2],
  ) => Promise<void>;
};
type McpAuditAttribution = {
  outcome: "success";
  channel: "mcp";
  userId: string;
  subjectUserId: string;
  oauthClientId: string;
  oauthGrantId: string;
  sessionId: string;
};
type McpChecks = {
  verifyState: () => Promise<void>;
  audits?: (
    attribution: McpAuditAttribution,
  ) => Pick<
    AuditLog,
    | keyof McpAuditAttribution
    | "action"
    | "targetId"
    | "targetType"
    | "metadata"
  >[];
};

/** Fixed scenario plans check real SDK calls; they never select tests or derive
 * expected usage from production tool mappings or the observed request log. */
async function runMcpScenario(
  page: Page,
  worker: OAuthOwner["worker"],
  io: CalendarProtocol,
  plan: McpPlan,
  work: (io: McpScenario) => Promise<McpChecks>,
): Promise<CalendarProtocolChecks> {
  const db = worker.database.owner;
  const actor = await worker.createActor();
  await page.context().addCookies([actor.cookie]);
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  const oauth: OAuth = { worker, clientNames: [], user };
  const sessions = await db.session.findMany({
    select: { id: true, userId: true },
  });
  expect(sessions).toEqual([{ id: expect.any(String), userId: user.id }]);
  const resource = `${worker.origin}/api/mcp`;
  const { clientId, accessToken, refreshToken } = await issueAccessToken(
    page,
    io.request,
    {
      owner: oauth,
      scope: MCP_CLIENT_SCOPE,
      clientScopes: MCP_CLIENT_SCOPES,
      resource,
    },
  );
  expect(refreshToken).toBeUndefined();
  const client = await io.mcp(
    { name: "life-ustc-e2e-client", version: "1.0.0" },
    accessToken,
  );
  const windows: (OAuthUsageWindow & { feature: string })[] = [];
  let calls = 0;
  let listings = 0;
  let calendarObserved = false;
  const checks = await work({
    oauth,
    request: io.request,
    async observeCalendar(messages, options) {
      calendarObserved = true;
      await io.observeCalendar(user, messages, options);
    },
    mcp: {
      async callTool(...args) {
        const planned = plan.calls[calls++];
        if (!planned) throw new Error("Unplanned MCP tool call");
        const [tool, feature, operation] = planned;
        expect(args[0].name).toBe(tool);
        const start = Date.now();
        const result = await client.callTool(...args);
        if (feature !== undefined && operation !== undefined)
          windows.push({ start, end: Date.now(), feature, operation });
        return result;
      },
      async listTools(...args) {
        expect(plan.listTools).toBe(true);
        listings++;
        return client.listTools(...args);
      },
    },
  });
  expect(calendarObserved).toBe(true);
  return {
    async verifyTransport({ effects, sdkRequests }) {
      for (const [method, path, status] of [
        ["POST", "/api/auth/oauth2/register", 201],
        ["GET", "/api/auth/oauth2/authorize", 302],
        ["POST", "/oauth/authorize", 200],
        ["POST", "/api/auth/oauth2/token", 200],
      ] as const) {
        expect(
          effects.requests
            .filter(
              ({ value }) => value.method === method && value.path === path,
            )
            .map(({ result }) => result),
        ).toEqual([status]);
      }
      expect(
        sdkRequests
          .map(({ method, rpc }) => `${method} ${rpc ?? "stream"}`)
          .sort(),
      ).toEqual([
        "GET stream",
        "POST initialize",
        "POST notifications/initialized",
        ...plan.calls.map(() => "POST tools/call"),
        ...(plan.listTools ? ["POST tools/list"] : []),
      ]);
      expect(
        sdkRequests
          .filter(({ rpc }) => rpc === "tools/call")
          .map(({ tool }) => tool),
      ).toEqual(plan.calls.map(([tool]) => tool));
      expect(calls).toBe(plan.calls.length);
      expect(listings).toBe(plan.listTools ? 1 : 0);
    },
    async verifyState() {
      // Domain state is checked independently, even if OAuth evidence fails.
      const results = await Promise.allSettled([
        checks.verifyState(),
        (async () => {
          expect(
            await db.user.findUniqueOrThrow({ where: { id: user.id } }),
          ).toEqual(user);
          expect(user.calendarFeedToken).toBeNull();
          expect(
            await db.session.findMany({ select: { id: true, userId: true } }),
          ).toEqual(sessions);
          expect(oauth.clientNames).toHaveLength(1);
          expect(
            await db.oAuthClient.findMany({
              select: {
                clientId: true,
                name: true,
                userId: true,
                redirectUris: true,
                grantTypes: true,
                responseTypes: true,
                tokenEndpointAuthMethod: true,
                applicationType: true,
              },
            }),
          ).toEqual([
            {
              clientId,
              name: oauth.clientNames[0],
              userId: null,
              redirectUris: [`${worker.origin}/e2e/oauth/callback`],
              grantTypes: ["authorization_code"],
              responseTypes: ["code"],
              tokenEndpointAuthMethod: "none",
              applicationType: "native",
            },
          ]);
          const consents = await db.oAuthConsent.findMany({
            select: {
              clientId: true,
              userId: true,
              grantId: true,
              scopes: true,
              resources: true,
              requestedUserInfoClaims: true,
            },
          });
          expect(consents).toEqual([
            {
              clientId,
              userId: user.id,
              grantId: expect.any(String),
              scopes: MCP_CLIENT_SCOPES,
              resources: [resource],
              requestedUserInfoClaims: [],
            },
          ]);
          const grantId = consents[0].grantId;
          expect(grantId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          );
          const auditRows = await db.auditLog.findMany({
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
          });
          const expectedAudits = [
            {
              action: "oauth_authorization_grant",
              outcome: "success",
              channel: "web",
              userId: user.id,
              subjectUserId: user.id,
              targetId: clientId,
              targetType: "oauth_client",
              oauthClientId: clientId,
              oauthGrantId: grantId,
              sessionId: sessions[0].id,
              metadata: {
                changedFields: ["resources", "scopes", "userinfoClaims"],
                resourceCount: 1,
                scopeCount: MCP_CLIENT_SCOPES.length,
              },
            },
            ...(checks.audits?.({
              outcome: "success",
              channel: "mcp",
              userId: user.id,
              subjectUserId: user.id,
              oauthClientId: clientId,
              oauthGrantId: grantId,
              sessionId: sessions[0].id,
            }) ?? []),
          ];
          expect(auditRows).toHaveLength(expectedAudits.length);
          // Consume each expected row once: repeated description audits are
          // distinct required writes, not reusable arrayContaining matches.
          const remainingAudits = [...auditRows];
          for (const expected of expectedAudits) {
            const index = remainingAudits.findIndex((row) =>
              isDeepStrictEqual(row, expected),
            );
            expect(index, JSON.stringify(expected)).toBeGreaterThanOrEqual(0);
            remainingAudits.splice(index, 1);
          }
          expect(remainingAudits).toEqual([]);
          expect(await db.oAuthRefreshToken.count()).toBe(0);
          expect(await db.oAuthAccessToken.count()).toBe(0);
          expect(await db.deviceCode.count()).toBe(0);
          const rows = await db.oAuthGrantUsageDaily.findMany({
            orderBy: { day: "asc" },
          });
          for (const row of rows)
            expect(plan.usage.map(([feature]) => feature)).toContain(
              row.feature,
            );
          for (const [feature, reads, writes] of plan.usage)
            expectOAuthUsage(
              rows.filter((row) => row.feature === feature),
              {
                dimensions: {
                  userId: user.id,
                  clientId,
                  grantId,
                  feature,
                  channel: "mcp",
                },
                counts: [reads, writes, 0],
                windows: windows.filter((window) => window.feature === feature),
              },
            );
        })(),
      ]);
      const errors = results
        .filter(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        )
        .map(({ reason }) => reason);
      if (errors.length)
        throw new AggregateError(errors, "MCP final state checks failed");
    },
  };
}
