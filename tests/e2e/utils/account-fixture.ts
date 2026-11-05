import { expect } from "@playwright/test";
import type {
  AuditAction,
  User,
} from "../../../src/generated/prisma-node/client";
import {
  type AccountWrite,
  createAccountWriteObserver,
} from "./account-write-observer";
import { withBrowserWorkflow } from "./browser-workflow";
import {
  type CalendarBrowserWriteVerifier,
  withCalendarProtocol,
} from "./calendar-protocol-lifecycle";
import { test as workerTest } from "./owned-worker";

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
  accountRun: async ({ page, playwright, isolatedWorker, run }, use) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use(({ writes, audits, verifyWrite }, work) => {
        const observer = createAccountWriteObserver(writes, verifyWrite);
        return workflow.run(() =>
          run(() =>
            withCalendarProtocol(
              {
                page,
                isolatedWorker,
                createRequest: (headers) =>
                  playwright.request.newContext({
                    baseURL: isolatedWorker.origin,
                    extraHTTPHeaders: headers,
                  }),
                runBody: workflow.body,
                verifyBrowserWrite: observer.observe,
              },
              async () => {
                const users = await isolatedWorker.database.owner.user.findMany(
                  { orderBy: { id: "asc" } },
                );
                const verifyState = await work();
                return {
                  async verifyTransport({ effects, sdkRequests }) {
                    observer.assertStateObserved();
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
