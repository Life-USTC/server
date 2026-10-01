import { expect } from "@playwright/test";
import type {
  AuditAction,
  User,
} from "../../../src/generated/prisma-node/client";
import { withBrowserWorkflow } from "./browser-workflow";
import {
  type CalendarBrowserWriteVerifier,
  withCalendarProtocol,
} from "./calendar-protocol-lifecycle";
import { test as workerTest } from "./owned-worker";

type AccountWrite = readonly [
  path: string,
  status: number,
  action?: string,
  redirect?: string,
];
type AccountStateCheck = () => Promise<void>;
type AccountPlan = {
  writes: readonly AccountWrite[];
  audits: readonly AuditAction[];
  verifyWrite?: CalendarBrowserWriteVerifier;
};

/** A signed-in account exists only for cases requesting it. */
export const test = workerTest.extend<{
  account: User;
  accountRun: (
    plan: AccountPlan,
    work: () => Promise<void> | Promise<AccountStateCheck>,
  ) => Promise<void>;
}>({
  account: async ({ isolatedWorker, page, run }, use) => {
    const account = await run(async () => {
      const marker = crypto.randomUUID().replaceAll("-", "");
      const account = await isolatedWorker.database.owner.user.create({
        data: {
          id: crypto.randomUUID(),
          name: `E2E account ${marker.slice(0, 8)}`,
          username: `e2e${marker.slice(0, 17)}`,
          email: `e2e-account-${marker}@example.test`,
          emailVerified: true,
        },
      });
      const session = await isolatedWorker.createSession(account.id);
      await page.context().addCookies([session.cookie]);
      return account;
    });
    await use(account);
  },
  accountRun: async (
    { page, request, playwright, isolatedWorker, run },
    use,
    testInfo,
  ) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use(({ writes, audits, verifyWrite }, work) => {
        const browserWrites = [...writes];
        return workflow.run(() =>
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
                async verifyBrowserWrite(response, incoming) {
                  const url = new URL(incoming.url());
                  expect(incoming.method()).toBe("POST");
                  const index = browserWrites.findIndex(
                    ([path, , action]) =>
                      path === url.pathname &&
                      url.search === (action ? `?/${action}` : ""),
                  );
                  if (index < 0)
                    throw new Error(
                      `Unplanned account write: ${url.pathname}${url.search}`,
                    );
                  const [planned] = browserWrites.splice(index, 1);
                  const [, status, action, redirect] = planned;
                  expect(response.status()).toBe(status);
                  await response.body();
                  if (action) expect(url.search).toBe(`?/${action}`);
                  if (redirect && status === 303)
                    expect(response.headers().location).toBe(redirect);
                  else if (redirect)
                    expect(await response.json()).toMatchObject({
                      type: "redirect",
                      status: 303,
                      location: redirect,
                    });
                  if (verifyWrite) await verifyWrite(response, incoming);
                },
              },
              async () => {
                const users = await isolatedWorker.database.owner.user.findMany(
                  { orderBy: { id: "asc" } },
                );
                const verifyState = await work();
                return {
                  async verifyTransport({ effects, sdkRequests }) {
                    expect(sdkRequests).toEqual([]);
                    expect(
                      effects.requests
                        .filter(
                          ({ value }) =>
                            !["GET", "HEAD"].includes(value.method),
                        )
                        .map(({ value, result }) => [
                          value.method,
                          value.path,
                          result,
                        ]),
                    ).toEqual(
                      writes.map(([path, status]) => ["POST", path, status]),
                    );
                  },
                  async verifyState() {
                    // The native audit queue is independent of request waitUntil.
                    await expect
                      .poll(() =>
                        isolatedWorker.database.owner.auditLog.count(),
                      )
                      .toBe(audits.length);
                    expect(
                      (
                        await isolatedWorker.database.owner.auditLog.findMany({
                          select: { action: true },
                        })
                      )
                        .map(({ action }) => action)
                        .sort(),
                    ).toEqual([...audits].sort());
                    if (verifyState) await verifyState();
                    else
                      expect(
                        await isolatedWorker.database.owner.user.findMany({
                          orderBy: { id: "asc" },
                        }),
                      ).toEqual(users);
                  },
                };
              },
            ),
          ),
        );
      });
    });
  },
});
