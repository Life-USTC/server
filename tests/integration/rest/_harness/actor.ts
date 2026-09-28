import { type APIRequestContext, test as base } from "@playwright/test";
import { PLAYWRIGHT_BASE_URL } from "../../../e2e/utils/e2e-db/core";
import { withE2ePrisma } from "../../../e2e/utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../e2e/utils/workspace-task-filters";

type ApiActor = { id: string; request: APIRequestContext };
type CreateActor = (options?: { isAdmin?: boolean }) => Promise<ApiActor>;

/** Test-owned identities with actual session authentication through the Worker.
 * Public domain records must be owned and cleaned by their domain fixture.
 */
export const test = base.extend<{ createActor: CreateActor }>({
  createActor: async ({ playwright }, use) => {
    const userIds: string[] = [];
    const contexts: APIRequestContext[] = [];
    const cleanup = async () => {
      // Stop request contexts before removing the state they can still use.
      const results = await Promise.allSettled(
        contexts.map((context) => context.dispose()),
      );
      results.push(
        ...(await Promise.allSettled([
          withE2ePrisma((db) =>
            db.$transaction(async (tx) => {
              await tx.auditLog.deleteMany({
                where: {
                  OR: [
                    { userId: { in: userIds } },
                    { subjectUserId: { in: userIds } },
                  ],
                },
              });
              await tx.featureOperationEvent.deleteMany({
                where: { userId: { in: userIds } },
              });
              await tx.user.deleteMany({ where: { id: { in: userIds } } });
            }),
          ),
        ])),
      );
      const errors = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (errors.length)
        throw new AggregateError(errors, "API actor cleanup failed");
    };
    try {
      await use(async ({ isAdmin = false } = {}) => {
        const id = crypto.randomUUID();
        // Register ownership before acquisition so response/setup failures clean up too.
        userIds.push(id);
        await withE2ePrisma((db) =>
          db.user.create({
            data: {
              id,
              name: `API actor ${id}`,
              email: `${id}@api-actor.test`,
              emailVerified: true,
              isAdmin,
            },
          }),
        );
        const cookie = await createSignedSessionCookie(id);
        const origin = new URL(cookie.url);
        const request = await playwright.request.newContext({
          baseURL: PLAYWRIGHT_BASE_URL,
          storageState: {
            origins: [],
            cookies: [
              {
                name: cookie.name,
                value: cookie.value,
                domain: origin.hostname,
                path: "/",
                expires: -1,
                httpOnly: true,
                secure: origin.protocol === "https:",
                sameSite: "Lax",
              },
            ],
          },
        });
        contexts.push(request);
        return { id, request };
      });
    } finally {
      await cleanup();
    }
  },
});
