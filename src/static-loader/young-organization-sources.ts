import type { Prisma } from "../generated/prisma-node/client";
import { chunks } from "./database-writes";
import type { YoungEventBuild } from "./young-plan";

const ROLES = ["sponsor", "organizer"] as const;
type SourceRow = { eventId: number; role: string; sourceId: string };
type SourceScope = { eventId: number; role: string; ids: string[] };

/** Called within the existing import transaction only after the Young freshness gate. */
export async function syncYoungOrganizationSources(
  tx: Prisma.TransactionClient,
  builds: YoungEventBuild[],
  options: { sourceObservedAt: Date; complete: boolean },
): Promise<void> {
  if (!Number.isFinite(options.sourceObservedAt.getTime())) {
    throw new Error(
      "Young organization source observation requires a valid source timestamp",
    );
  }
  const observed = builds.filter((build) =>
    ROLES.some((role) => build.organizationSources?.[role] !== undefined),
  );
  for (const batch of chunks(observed, 1000)) {
    const rows = await tx.youngEvent.findMany({
      where: { youngId: { in: batch.map((build) => build.youngId) } },
      select: { id: true, youngId: true },
    });
    const eventIds = new Map(rows.map((row) => [row.youngId, row.id]));
    const sources: SourceRow[] = [];
    const completeScopes: SourceScope[] = [];
    for (const build of batch) {
      const eventId = eventIds.get(build.youngId);
      if (eventId === undefined) {
        throw new Error(
          "Missing imported Young event for organization source observation",
        );
      }
      for (const role of ROLES) {
        const observation = build.organizationSources?.[role];
        if (observation === undefined) continue;
        const ids = [...new Set(observation.ids)];
        for (const sourceId of ids) sources.push({ eventId, role, sourceId });
        if (options.complete && observation.complete) {
          completeScopes.push({ eventId, role, ids });
        }
      }
    }
    for (const sourceBatch of chunks(sources, 500)) {
      const params: Array<number | string | Date> = [];
      const values = sourceBatch.map(({ eventId, role, sourceId }) => {
        const base = params.length;
        params.push(eventId, role, sourceId, options.sourceObservedAt);
        return `($${base + 1}::int,$${base + 2}::text,$${base + 3}::text,$${base + 4}::timestamp)`;
      });
      await tx.$executeRawUnsafe(
        `INSERT INTO "YoungEventOrganizationSource" ("eventId", "role", "sourceId", "sourceObservedAt")
         VALUES ${values.join(",")}
         ON CONFLICT ("eventId", "role", "sourceId") DO UPDATE
           SET "sourceObservedAt" = EXCLUDED."sourceObservedAt"
         WHERE "YoungEventOrganizationSource"."sourceObservedAt" IS DISTINCT FROM EXCLUDED."sourceObservedAt"`,
        ...params,
      );
    }
    for (const scopeBatch of chunks(completeScopes, 500)) {
      // Each row contains its own event/role/member set. Independent IN lists
      // would create a cross product and could remove another event's members.
      await tx.$executeRawUnsafe(
        `DELETE FROM "YoungEventOrganizationSource" AS target
         USING jsonb_to_recordset($1::jsonb) AS desired("eventId" int, role text, ids jsonb)
         WHERE target."eventId" = desired."eventId" AND target.role = desired.role
           AND NOT EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(desired.ids) AS keep("sourceId")
             WHERE keep."sourceId" = target."sourceId"
           )`,
        JSON.stringify(scopeBatch),
      );
    }
  }
}
