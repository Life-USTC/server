import { createHash } from "node:crypto";
import { vi } from "vitest";
import type { CloudflareAnalyticsEngineDataPoint } from "@/lib/adapters/cloudflare-runtime";
import {
  type CatalogContractFixture,
  createCatalogContractFixture,
} from "./catalog-contract-fixture";
import { isolatedDatabaseTest } from "./isolated-database";
import { createNodeRuntime } from "./node-runtime";
import type { TestPrismaClient } from "./prisma";

type StoredResponse = { body: string; status: number; headers: Headers };
type DiscoveryLifetime = {
  start: number;
  kv: Map<string, string>;
  colo: Map<string, StoredResponse>;
  analytics: CloudflareAnalyticsEngineDataPoint[];
  run<T>(work: () => T | Promise<T>): Promise<T>;
  request<T>(read: () => T | Promise<T>): Promise<T>;
};
type PublicDiscovery = DiscoveryLifetime & {
  db: TestPrismaClient;
  catalog: CatalogContractFixture;
  users: { id: string }[];
  revise(label: string): Promise<void>;
};

// Each consumer has one test in an isolated Vitest file. Its process owns the
// production memory cache and fake Date; colo/KV below are controlled bindings.
export const publicDiscoveryTest = isolatedDatabaseTest.extend<{
  _discoveryLifetime: DiscoveryLifetime;
  discovery: PublicDiscovery;
}>({
  _discoveryLifetime: async ({ isolatedDatabase }, use) => {
    const { connections } = isolatedDatabase;
    const start = new Date("2031-01-12T00:00:00.000Z").getTime();
    const kv = new Map<string, string>();
    const colo = new Map<string, StoredResponse>();
    const analytics: CloudflareAnalyticsEngineDataPoint[] = [];
    // The complete callback can still issue requests after the test times out.
    // Keep the request runtime open until this outer owner has drained it.
    const lifetime = createNodeRuntime({});
    const requests = createNodeRuntime({
      HYPERDRIVE: { connectionString: connections.app },
      HYPERDRIVE_AUTH: { connectionString: connections.auth },
      ANALYTICS: {
        writeDataPoint: (point: CloudflareAnalyticsEngineDataPoint) => {
          analytics.push(point);
        },
      },
      CATALOG_DETAIL_CORE: {
        get: async (key: string) => {
          const value = kv.get(key);
          return value ? JSON.parse(value) : null;
        },
        put: async (key: string, value: string) => {
          kv.set(key, value);
        },
      },
    });
    const failures: unknown[] = [];
    try {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(start);
      vi.stubGlobal("caches", {
        open: async () => ({
          match: async (request: Request) => {
            const stored = colo.get(request.url);
            return stored ? new Response(stored.body, stored) : undefined;
          },
          // Consume bytes like the Cache API instead of retaining tee branches.
          put: async (request: Request, response: Response) => {
            colo.set(request.url, {
              body: await response.text(),
              status: response.status,
              headers: new Headers(response.headers),
            });
          },
        }),
      });
      // Register teardown before catalog setup or a dependent fixture can time out.
      await use({
        start,
        kv,
        colo,
        analytics,
        run: lifetime.run,
        request: requests.run,
      });
    } catch (error) {
      failures.push(error);
    }
    const results = await Promise.allSettled([lifetime.close()]);
    results.push(...(await Promise.allSettled([requests.close()])));
    // Response completion alone does not mean the outer DB assertions finished.
    vi.useRealTimers();
    vi.unstubAllGlobals();
    failures.push(
      ...results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      ),
    );
    if (failures.length)
      throw new AggregateError(failures, "Public discovery cleanup failed");
  },
  discovery: async (
    { isolatedDatabase, _discoveryLifetime: lifetime },
    use,
  ) => {
    const state = await lifetime.run(async () => {
      const db = isolatedDatabase.owner;
      const catalog = await createCatalogContractFixture(db);
      const users = [0, 1].map((index) => ({
        id: `${catalog.marker}-cache-${index}`,
      }));
      await db.user.createMany({
        data: users.map(({ id }) => ({ id, email: `${id}@test.invalid` })),
      });
      async function revise(label: string) {
        const data = {
          snapshotGeneratedAt: new Date(),
          snapshotSha256: createHash("sha256")
            .update(`${catalog.marker}-${label}`)
            .digest("hex"),
          transformRevision: 1,
          updatedAt: new Date(),
        };
        await db.staticImportState.upsert({
          where: { id: "global" },
          create: { id: "global", ...data },
          update: data,
        });
      }
      await revise("initial");
      return { ...lifetime, db, catalog, users, revise };
    });
    await use(state);
    // The parent fixture drops this case's database, including partial setup.
  },
});
