import { createLocalAccountIssuer } from "@better-auth/core/db";
import { expect } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { withBrowserWorkflow } from "../../../../utils/browser-workflow";
import { test as workerTest } from "../../../../utils/owned-worker";
import { withSettledPageWrites } from "../../../../utils/settled-page-writes";

type WritePlan =
  | { kind: "sign-in"; state: string }
  | {
      kind: "consent";
      state: string;
      decision: "allow" | "deny";
      loopback: boolean;
    };
type ConsentGate = { wait: Promise<void>; release: () => void };

// OAuth exercises fixed debug identities and auth-owned authorization-code state.
// Each case owns the actual Worker, its auth database and generated clients.
export const test = workerTest.extend<{
  actor: string;
  redirectUri: string;
  debugUser: string;
  oauthRun: (
    plan: WritePlan | null,
    work: () => Promise<void>,
    gate?: ConsentGate,
  ) => Promise<void>;
}>({
  actor: async ({ isolatedWorker, page, run }, use) => {
    const id = await run(async () => {
      const actor = await isolatedWorker.createActor();
      await page.context().addCookies([actor.cookie]);
      return actor.id;
    });
    await use(id);
  },
  debugUser: async ({ isolatedWorker, run }, use) => {
    const id = await run(async () => {
      const id = crypto.randomUUID();
      await isolatedWorker.database.owner.user.create({
        data: {
          id,
          email: "dev-user@debug.local",
          emailVerified: true,
          name: "Dev User",
          username: "dev-user",
          accounts: {
            create: {
              type: "credential",
              provider: "credential",
              issuer: createLocalAccountIssuer("credential"),
              providerAccountId: id,
              password: await hashPassword("dev-debug-password"),
            },
          },
        },
      });
      return id;
    });
    await use(id);
  },
  redirectUri: async ({ isolatedWorker }, use) => {
    await use(`${isolatedWorker.origin}/e2e/oauth/callback`);
  },
  oauthRun: async ({ page, isolatedWorker, run }, use) => {
    const origin = isolatedWorker.origin;
    await withBrowserWorkflow(page, async (workflow) => {
      await use((plan, work, gate) =>
        workflow.run(() =>
          run(async () => {
            let writes = 0;
            let held = 0;
            if (gate) expect(plan?.kind).toBe("consent");
            await withSettledPageWrites(
              page,
              (url) => url.origin === origin,
              async () => {
                try {
                  await workflow.body(work);
                } finally {
                  // Interruption releases the submitted request before its owner
                  // settles/fulfills it, closes the page, and joins the real body.
                  gate?.release();
                }
              },
              async (response, incoming) => {
                if (!plan)
                  throw new Error(
                    "Read-only OAuth flow submitted a browser write",
                  );
                writes++;
                expect(writes).toBe(1);
                const url = new URL(incoming.url());
                expect(incoming.method()).toBe("POST");
                expect(url.pathname).toBe(
                  plan.kind === "sign-in"
                    ? "/account/sign-in"
                    : "/oauth/authorize",
                );
                if (plan.kind === "consent")
                  expect(url.search).toBe("?/consent");
                expect(response.status()).toBe(200);
                const body = await response.json();
                expect(body).toEqual({
                  type: "redirect",
                  status: 303,
                  location: expect.any(String),
                });
                const destination = new URL(body.location, origin);
                expect(destination.searchParams.get("state")).toBe(plan.state);
                if (plan.kind === "sign-in") {
                  expect(destination.origin).toBe(origin);
                  expect(destination.pathname).toBe("/oauth/authorize");
                } else {
                  const callback = new URL("/e2e/oauth/callback", origin);
                  if (plan.loopback) callback.hostname = "127.0.0.1";
                  expect(destination.origin).toBe(callback.origin);
                  expect(destination.pathname).toBe(callback.pathname);
                  if (plan.decision === "allow") {
                    expect(destination.searchParams.get("code")).toMatch(
                      /^[A-Za-z0-9]{32}$/,
                    );
                    expect(destination.searchParams.has("error")).toBe(false);
                  } else {
                    expect(destination.searchParams.get("error")).toBe(
                      "access_denied",
                    );
                    expect(
                      destination.searchParams.get("error_description"),
                    ).toBe("User denied access");
                    expect(destination.searchParams.has("code")).toBe(false);
                  }
                }
              },
              async (incoming) => {
                if (!gate) return;
                expect(incoming.method()).toBe("POST");
                const url = new URL(incoming.url());
                expect(url.pathname).toBe("/oauth/authorize");
                expect(url.search).toBe("?/consent");
                held++;
                expect(held).toBe(1);
                await gate.wait;
              },
            );
            expect(writes).toBe(plan ? 1 : 0);
            expect(held).toBe(gate ? 1 : 0);
          }),
        ),
      );
    });
  },
});
