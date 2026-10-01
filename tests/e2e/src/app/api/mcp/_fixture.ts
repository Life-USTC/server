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
  oauthOwner: async ({ isolatedWorker }, use) => {
    await use({ worker: isolatedWorker, clientNames: [] });
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
  const session = await db.session.findFirstOrThrow({
    where: { userId: user.id },
    select: { id: true },
  });
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
    async verifyTransport({ sdkRequests }) {
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
      // Domain state and per-feature audit/usage effects are independent observations.
      const results = await Promise.allSettled([
        checks.verifyState(),
        (async () => {
          expect(
            await db.user.findUniqueOrThrow({ where: { id: user.id } }),
          ).toEqual(user);
          expect(user.calendarFeedToken).toBeNull();
          const { grantId } = await db.oAuthConsent.findUniqueOrThrow({
            where: { clientId_userId: { clientId, userId: user.id } },
            select: { grantId: true },
          });
          const auditRows = await db.auditLog.findMany({
            where: { action: { not: "oauth_authorization_grant" } },
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
          const expectedAudits =
            checks.audits?.({
              outcome: "success",
              channel: "mcp",
              userId: user.id,
              subjectUserId: user.id,
              oauthClientId: clientId,
              oauthGrantId: grantId,
              sessionId: session.id,
            }) ?? [];
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
