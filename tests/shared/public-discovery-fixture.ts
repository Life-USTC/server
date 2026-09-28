import { createHash } from "node:crypto";
import { vi } from "vitest";
import { resetPublicRuntimeCacheForTest } from "@/lib/public-runtime-cache";
import {
  type CatalogContractFixture,
  createCatalogContractFixture,
} from "./catalog-contract-fixture";
import { isolatedDatabaseTest } from "./isolated-database";
import { createNodeRuntime } from "./node-runtime";
import type { TestPrismaClient } from "./prisma";

type StoredResponse = { body: string; status: number; headers: Headers };
type PublicDiscovery = {
  db: TestPrismaClient;
  catalog: CatalogContractFixture;
  users: { id: string }[];
  start: number;
  kv: Map<string, string>;
  colo: Map<string, StoredResponse>;
  request<T>(read: () => T | Promise<T>): Promise<T>;
  revise(label: string): Promise<void>;
};

// Each consumer has one test in an isolated Vitest file because the production
// memory cache, Cache API binding and Date are process globals.
export const publicDiscoveryTest = isolatedDatabaseTest.extend<{
  discovery: PublicDiscovery;
}>({
  discovery: async ({ isolatedDatabase }, use) => {
    const db = isolatedDatabase.owner;
    const { connections } = isolatedDatabase;
    const start = new Date("2031-01-12T00:00:00.000Z").getTime();
    const kv = new Map<string, string>();
    const colo = new Map<string, StoredResponse>();
    const { run: request, close } = createNodeRuntime({
      HYPERDRIVE: { connectionString: connections.app },
      HYPERDRIVE_AUTH: { connectionString: connections.auth },
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

    try {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(start);
      resetPublicRuntimeCacheForTest();
      vi.stubGlobal("caches", {
        open: async () => ({
          match: async (request: Request) => {
            const stored = colo.get(request.url);
            return stored ? new Response(stored.body, stored) : undefined;
          },
          // Store consumed bytes, like the Cache API, rather than retaining
          // unread tee branches for every response clone.
          put: async (request: Request, response: Response) => {
            colo.set(request.url, {
              body: await response.text(),
              status: response.status,
              headers: new Headers(response.headers),
            });
          },
        }),
      });
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
      await use({ db, catalog, users, start, kv, colo, request, revise });
    } finally {
      await cleanup();
    }
    async function cleanup() {
      try {
        await close();
      } finally {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        resetPublicRuntimeCacheForTest();
        kv.clear();
        colo.clear();
      }
      // The parent fixture drops this case's whole database, including partial
      // setup, revision, catalog additions, private rows and observations.
    }
  },
});
