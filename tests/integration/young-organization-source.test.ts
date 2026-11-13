import { readFileSync } from "node:fs";
import { Client } from "pg";
import {
  toYoungEventSummary,
  YOUNG_EVENT_SELECT,
} from "@/features/young/server/young-event-service";
import { recordStaticImportState } from "@/static-loader/import-state";
import {
  syncYoungEvents,
  syncYoungSnapshot,
} from "@/static-loader/import-young";
import type { Snapshot } from "@/static-loader/snapshot";
import { syncYoungOrganizationSources } from "@/static-loader/young-organization-sources";
import {
  loadYoungEvents,
  type YoungEventBuild,
} from "@/static-loader/young-plan";
import type { TestPrismaClient } from "../shared/prisma";
import { staticImporterTest } from "../shared/static-importer-fixture";

const migrationSql = () =>
  readFileSync(
    "prisma/migrations/20261113010000_young_organization_source_shadow/migration.sql",
    "utf8",
  );
const it = staticImporterTest.extend<{ organizationSourceSchema: void }>({
  organizationSourceSchema: [
    async ({ isolatedDatabase }, use) => {
      // Existing fixture templates clone the configured schema without deploying
      // pending branch migrations. Expand only this case's owned database.
      const connection = new Client({
        connectionString: isolatedDatabase.connections.owner,
      });
      await connection.connect();
      try {
        const {
          rows: [row],
        } = await connection.query<{ present: boolean }>(
          `SELECT to_regclass('public."YoungEventOrganizationSource"') IS NOT NULL AS present`,
        );
        if (!row.present) await connection.query(migrationSql());
      } finally {
        await connection.end();
      }
      await use(undefined);
    },
    { auto: true },
  ],
});

const at = new Date("2030-01-01T00:00:00Z");
const later = new Date("2030-01-02T00:00:00Z");
const table = "young_mobile_item_enrolment_list_result_records";
const service = { tags: ["@Young/Service"] };
function plan(
  id: string,
  input: Record<string, unknown> = {},
): YoungEventBuild {
  const snapshot = {
    metadata: () => ({ young_events_mode: "full" }),
    hasTable: (name: string) => name === table,
    queryAll: () => [
      {
        id,
        itemName: "Source membership fixture",
        organizer_dictText: "One legacy display label",
        ...input,
      },
    ],
    queryGrouped: () => new Map(),
  } as unknown as Snapshot;
  const result = loadYoungEvents(snapshot)?.[0];
  if (!result) throw new Error("Missing source fixture plan");
  return result;
}
async function apply(
  db: TestPrismaClient,
  builds: YoungEventBuild[],
  sourceAt: Date,
) {
  return db.$transaction(async (tx) => {
    const accepted = await syncYoungSnapshot(tx, builds, sourceAt);
    if (accepted)
      await recordStaticImportState(tx, {
        observedAt: sourceAt,
        youngSyncedAt: accepted,
        snapshotSha256: "a".repeat(64),
        transformRevision: 6,
      });
    return accepted;
  });
}
async function sources(db: TestPrismaClient) {
  return db.youngEventOrganizationSource.findMany({
    orderBy: [{ eventId: "asc" }, { role: "asc" }, { sourceId: "asc" }],
  });
}
async function legacy(db: TestPrismaClient) {
  return {
    identities: await db.youngEvent.findMany({
      select: {
        id: true,
        youngId: true,
        organizer: true,
        organizerId: true,
        createdAt: true,
      },
      orderBy: { id: "asc" },
    }),
    follows: await db.userYoungOrganizerSubscription.findMany(),
    subscriptions: await db.userYoungEventSubscription.findMany(),
    notifications: await db.youngNotification.findMany(),
  };
}
async function followFixture(db: TestPrismaClient, eventId: string) {
  const event = await db.youngEvent.findUniqueOrThrow({
    where: { youngId: eventId },
  });
  if (!event.organizerId) throw new Error("Missing legacy organizer fixture");
  const user = await db.user.create({
    data: { email: `${crypto.randomUUID()}@example.test` },
  });
  await db.userYoungOrganizerSubscription.create({
    data: { userId: user.id, organizerId: event.organizerId },
  });
  await db.userYoungEventSubscription.create({
    data: {
      userId: user.id,
      youngId: eventId,
      observedState: "retained-state",
      observedRevision: 7,
    },
  });
  await db.youngNotification.create({
    data: {
      userId: user.id,
      organizerId: event.organizerId,
      youngId: eventId,
      kind: "organizer_digest",
      title: "Retained digest",
      body: "Retained body",
      dedupeKey: "retained-digest",
      readAt: at,
    },
  });
}

it(
  "young-event.organization-source-shadow",
  service,
  async ({
    importer,
    isolatedDatabase: { owner },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const quotedSourceId = String.raw`quote'\member`;
      const builds = [
        plan("opaque-event", {
          sponsor: ["shared"],
          organizer: ["id,comma", quotedSourceId, "Ａ", "A", "id,comma"],
        }),
        plan("8", { sponsor: "shared", organizer: "second" }),
      ];
      await apply(importer, builds, at);
      await followFixture(owner, "opaque-event");
      const before = await legacy(owner);
      const ids = new Map(
        before.identities.map((row) => [row.youngId, row.id]),
      );
      expect(Number.isInteger(ids.get("8"))).toBe(true);
      expect(
        new Set(before.identities.map((row) => row.organizerId)).size,
      ).toBe(1);
      const rows = await sources(owner);
      expect(rows).toHaveLength(7);
      expect(rows).toEqual(
        expect.arrayContaining([
          {
            eventId: ids.get("opaque-event"),
            role: "organizer",
            sourceId: "id,comma",
            sourceObservedAt: at,
          },
          {
            eventId: ids.get("opaque-event"),
            role: "organizer",
            sourceId: quotedSourceId,
            sourceObservedAt: at,
          },
          {
            eventId: ids.get("opaque-event"),
            role: "organizer",
            sourceId: "Ａ",
            sourceObservedAt: at,
          },
          {
            eventId: ids.get("opaque-event"),
            role: "organizer",
            sourceId: "A",
            sourceObservedAt: at,
          },
          {
            eventId: ids.get("opaque-event"),
            role: "sponsor",
            sourceId: "shared",
            sourceObservedAt: at,
          },
          {
            eventId: ids.get("8"),
            role: "sponsor",
            sourceId: "shared",
            sourceObservedAt: at,
          },
          {
            eventId: ids.get("8"),
            role: "organizer",
            sourceId: "second",
            sourceObservedAt: at,
          },
        ]),
      );
      await apply(importer, builds, later);
      expect(await sources(owner)).toEqual(
        rows.map((row) => ({ ...row, sourceObservedAt: later })),
      );
      expect(await legacy(owner)).toEqual(before);
      const summary = toYoungEventSummary(
        await owner.youngEvent.findUniqueOrThrow({
          where: { youngId: "opaque-event" },
          select: YOUNG_EVENT_SELECT,
        }),
      );
      expect(summary.organizerId).toBe(
        before.identities.find((row) => row.youngId === "opaque-event")
          ?.organizerId,
      );
      expect(summary).not.toHaveProperty("organizationSources");
    });
  },
);

it(
  "young-event.organization-source-reconciliation",
  service,
  async ({
    importer,
    isolatedDatabase: { owner },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      await apply(
        importer,
        [
          plan("first", { organizer: "shared,first", sponsor: "host" }),
          plan("second", { organizer: "shared,second", sponsor: "host" }),
        ],
        at,
      );
      // Incomplete evidence can add a valid token but cannot remove old members.
      await importer.$transaction((tx) =>
        syncYoungOrganizationSources(
          tx,
          [plan("first", { organizer: "new,," })],
          { sourceObservedAt: later, complete: true },
        ),
      );
      const first = await owner.youngEvent.findUniqueOrThrow({
        where: { youngId: "first" },
      });
      expect(
        (await sources(owner))
          .filter((row) => row.eventId === first.id && row.role === "organizer")
          .map((row) => row.sourceId)
          .sort(),
      ).toEqual(["first", "new", "shared"]);
      await importer.$transaction((tx) =>
        syncYoungOrganizationSources(
          tx,
          [plan("first", { organizer: "partial" })],
          { sourceObservedAt: later, complete: false },
        ),
      );
      expect(
        (await sources(owner)).filter(
          (row) => row.eventId === first.id && row.role === "organizer",
        ),
      ).toHaveLength(4);
      // Full known role sets are paired per event, never an IN-list cross product.
      await apply(
        importer,
        [
          plan("first", { organizer: "second", sponsor: "" }),
          plan("second", { organizer: "first" }),
        ],
        later,
      );
      const second = await owner.youngEvent.findUniqueOrThrow({
        where: { youngId: "second" },
      });
      expect(
        (await sources(owner)).map(({ eventId, role, sourceId }) => ({
          eventId,
          role,
          sourceId,
        })),
      ).toEqual(
        expect.arrayContaining([
          { eventId: first.id, role: "organizer", sourceId: "second" },
          { eventId: second.id, role: "organizer", sourceId: "first" },
          { eventId: second.id, role: "sponsor", sourceId: "host" },
        ]),
      );
      expect(await sources(owner)).toHaveLength(3);
      // The codec cannot prove an empty array from absent parent/child data.
      await apply(
        importer,
        [plan("first"), plan("second", { organizer: [] })],
        new Date("2030-01-03T00:00:00Z"),
      );
      expect(
        (await sources(owner)).map(({ eventId, role, sourceId }) => ({
          eventId,
          role,
          sourceId,
        })),
      ).toEqual([
        { eventId: first.id, role: "organizer", sourceId: "second" },
        { eventId: second.id, role: "sponsor", sourceId: "host" },
      ]);
      await apply(importer, [], new Date("2030-01-04T00:00:00Z"));
      expect(
        await owner.youngEvent.count({ where: { sourceMissing: true } }),
      ).toBe(2);
      expect(await sources(owner)).toHaveLength(2);
    });
  },
);

it(
  "young-event.organization-source-freshness-and-atomicity",
  service,
  async ({
    importer,
    isolatedDatabase: { owner },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      await apply(
        importer,
        [plan("retained", { organizer: "old", sponsor: "host" })],
        at,
      );
      await followFixture(owner, "retained");
      const before = {
        source: await sources(owner),
        legacy: await legacy(owner),
        events: await owner.youngEvent.findMany(),
      };
      for (const stale of [undefined, at, new Date(at.getTime() - 1000)]) {
        expect(
          await importer.$transaction((tx) =>
            syncYoungSnapshot(
              tx,
              [plan("retained", { organizer: "wrong" })],
              stale,
            ),
          ),
        ).toBeUndefined();
      }
      await expect(
        importer.$transaction(async (tx) => {
          await syncYoungSnapshot(
            tx,
            [
              plan("retained", {
                organizer: "replacement",
                itemName: "Must roll back",
              }),
              plan("new-event", { sponsor: "new" }),
            ],
            later,
          );
          throw new Error("Owned final-step fault");
        }),
      ).rejects.toThrow("Owned final-step fault");
      expect({
        source: await sources(owner),
        legacy: await legacy(owner),
        events: await owner.youngEvent.findMany(),
      }).toEqual(before);
    });
  },
);

it("young-event.organization-source-permissions", {
  tags: ["@Database/Permissions"],
}, async ({
  importer,
  isolatedDatabase: { owner, app, auth, maintenance },
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    await importer.$transaction((tx) =>
      syncYoungEvents(tx, [plan("permissions")]),
    );
    const event = await owner.youngEvent.findUniqueOrThrow({
      where: { youngId: "permissions" },
    });
    await importer.youngEventOrganizationSource.create({
      data: {
        eventId: event.id,
        role: "organizer",
        sourceId: "source",
        sourceObservedAt: at,
      },
    });
    expect(await importer.youngEventOrganizationSource.count()).toBe(1);
    await importer.youngEventOrganizationSource.updateMany({
      data: { sourceObservedAt: later },
    });
    expect((await sources(owner))[0]?.sourceObservedAt).toEqual(later);
    for (const client of [app, auth, maintenance]) {
      await expect(
        client.youngEventOrganizationSource.findMany(),
      ).rejects.toThrow(/permission denied/);
      await expect(
        client.youngEventOrganizationSource.create({
          data: {
            eventId: event.id,
            role: "sponsor",
            sourceId: "forged",
            sourceObservedAt: at,
          },
        }),
      ).rejects.toThrow(/permission denied/);
    }
    const acl = await owner.$queryRaw<
      Array<{
        role: string;
        read: boolean;
        insert: boolean;
        update: boolean;
        delete: boolean;
      }>
    >`
      SELECT rolname AS role,
        has_table_privilege(rolname, 'public."YoungEventOrganizationSource"', 'SELECT') AS read,
        has_table_privilege(rolname, 'public."YoungEventOrganizationSource"', 'INSERT') AS insert,
        has_table_privilege(rolname, 'public."YoungEventOrganizationSource"', 'UPDATE') AS update,
        has_table_privilege(rolname, 'public."YoungEventOrganizationSource"', 'DELETE') AS delete
      FROM pg_roles WHERE rolname = 'life_ustc_function_owner'
    `;
    expect(acl).toEqual([
      {
        role: "life_ustc_function_owner",
        read: false,
        insert: false,
        update: false,
        delete: false,
      },
    ]);
    await expect(
      importer.$queryRawUnsafe('SELECT * FROM "User"'),
    ).rejects.toThrow(/permission denied/);
    await expect(
      importer.$executeRawUnsafe(
        "CREATE TABLE public.shadow_forbidden (id int)",
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      importer.$executeRawUnsafe("SET ROLE life_ustc_runtime"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      importer.youngEventOrganizationSource.create({
        data: {
          eventId: event.id,
          role: "unknown",
          sourceId: "invalid-role",
          sourceObservedAt: at,
        },
      }),
    ).rejects.toThrow(/check constraint/);
    await expect(
      importer.youngEventOrganizationSource.create({
        data: {
          eventId: 2147483647,
          role: "sponsor",
          sourceId: "missing-event",
          sourceObservedAt: at,
        },
      }),
    ).rejects.toThrow(/foreign key constraint/i);
    await importer.youngEventOrganizationSource.deleteMany();
    expect(await sources(owner)).toEqual([]);
  });
});

it(
  "young-event.organization-source-expand-rollback",
  service,
  async ({
    importer,
    isolatedDatabase: { owner, connections },
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const build = plan("legacy-before-expand", { organizer: "one" });
      await importer.$transaction((tx) =>
        syncYoungEvents(tx, [build], { observedAt: at }),
      );
      await followFixture(owner, build.youngId);
      const before = await legacy(owner);
      const control = toYoungEventSummary(
        await owner.youngEvent.findUniqueOrThrow({
          where: { youngId: build.youngId },
          select: YOUNG_EVENT_SELECT,
        }),
      );
      const connection = new Client({ connectionString: connections.owner });
      await connection.connect();
      try {
        // Simulate an existing legacy database, then apply the actual new SQL with
        // pre-existing restricted roles; no bootstrap rerun may grant access.
        await connection.query('DROP TABLE "YoungEventOrganizationSource"');
        await connection.query(migrationSql());
        await apply(importer, [build], at);
        expect(await importer.youngEventOrganizationSource.count()).toBe(1);
        expect(await legacy(owner)).toEqual(before);
        const readDefaultAcl = () =>
          connection.query(
            `SELECT defaclrole, defaclnamespace, defaclobjtype, defaclacl::text
           FROM pg_default_acl ORDER BY defaclrole, defaclnamespace, defaclobjtype`,
          );
        const defaultsBefore = (await readDefaultAcl()).rows;
        await connection.query("BEGIN");
        try {
          await connection.query('DROP TABLE "YoungEventOrganizationSource"');
          // Default ACLs are database-local. Seed broad defaults and create the
          // new table in the same owned transaction, then always roll it back.
          await connection.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public
            GRANT ALL ON TABLES TO PUBLIC, life_ustc_runtime,
              life_ustc_auth_runtime, life_ustc_maintenance_runtime,
              life_ustc_function_owner, life_ustc_importer`);
          await connection.query(migrationSql());
          const restrictedRoles = [
            "life_ustc_runtime",
            "life_ustc_auth_runtime",
            "life_ustc_maintenance_runtime",
            "life_ustc_function_owner",
            "life_ustc_importer",
          ];
          const privileges = [
            "SELECT",
            "INSERT",
            "UPDATE",
            "DELETE",
            "TRUNCATE",
            "REFERENCES",
            "TRIGGER",
          ];
          const { rows: effective } = await connection.query<{
            role: string;
            privilege: string;
            allowed: boolean;
          }>(
            `SELECT role, privilege,
               has_table_privilege(role, 'public."YoungEventOrganizationSource"', privilege) AS allowed
             FROM unnest($1::text[]) AS roles(role)
             CROSS JOIN unnest($2::text[]) AS privileges(privilege)`,
            [restrictedRoles, privileges],
          );
          expect(effective).toHaveLength(35);
          for (const row of effective) {
            expect(row.allowed, `${row.role} ${row.privilege}`).toBe(
              row.role === "life_ustc_importer" &&
                ["SELECT", "INSERT", "UPDATE", "DELETE"].includes(
                  row.privilege,
                ),
            );
          }
          const {
            rows: [ownership],
          } = await connection.query<{
            ownerRead: boolean;
            ownerManage: boolean;
            publicGrants: number;
          }>(`SELECT
              has_table_privilege(current_user, 'public."YoungEventOrganizationSource"', 'SELECT') AS "ownerRead",
              has_table_privilege(current_user, 'public."YoungEventOrganizationSource"', 'TRUNCATE') AS "ownerManage",
              (SELECT count(*)::int FROM pg_class c,
                LATERAL aclexplode(c.relacl) a
                WHERE c.oid = 'public."YoungEventOrganizationSource"'::regclass
                  AND a.grantee = 0) AS "publicGrants"`);
          expect(ownership).toEqual({
            ownerRead: true,
            ownerManage: true,
            publicGrants: 0,
          });
        } finally {
          await connection.query("ROLLBACK");
        }
        expect((await readDefaultAcl()).rows).toEqual(defaultsBefore);
        expect(await sources(owner)).toHaveLength(1);
        // A down migration requires stopping the new writer first. Legacy reads
        // and the original scalar writer continue with the shadow table absent.
        await connection.query('DROP TABLE "YoungEventOrganizationSource"');
        await importer.$transaction((tx) =>
          syncYoungEvents(tx, [build], { observedAt: at }),
        );
        expect(await legacy(owner)).toEqual(before);
        expect(
          toYoungEventSummary(
            await owner.youngEvent.findUniqueOrThrow({
              where: { youngId: build.youngId },
              select: YOUNG_EVENT_SELECT,
            }),
          ),
        ).toEqual(control);
        await expect(
          apply(
            importer,
            [
              plan(build.youngId, {
                organizer: "replacement",
                itemName: "Must not survive",
              }),
            ],
            later,
          ),
        ).rejects.toThrow();
        expect(await legacy(owner)).toEqual(before);
        expect(
          (
            await owner.youngEvent.findUniqueOrThrow({
              where: { youngId: build.youngId },
            })
          ).name,
        ).toBe(build.name);
      } finally {
        await connection.end();
      }
    });
  },
);
