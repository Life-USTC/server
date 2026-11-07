import { cachedCatalogRuntimeData } from "@/features/catalog/server/catalog-runtime-cache";
import { withRuntimeDatabaseAdapter } from "@/lib/db/prisma-adapter";
import { getCanonicalOrigin } from "@/lib/site-url";
import { formatShanghaiTimestamp } from "@/lib/time/shanghai-format";

export type YoungHomeActivity = {
  youngId: string;
  name: string;
  startAt: string;
  endAt: string | null;
  location: string | null;
  organizer: string | null;
  crossDay: boolean;
};
type ActivityRow = [
  string,
  string,
  string,
  string | null,
  string | null,
  string | null,
];

function timestamp(value: string): string {
  // PrismaPg decodes PostgreSQL timestamp-without-time-zone as a UTC string.
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Invalid Young activity timestamp");
  return formatShanghaiTimestamp(date);
}

/** A private day-stable projection; each group is classified before its LIMIT. */
export async function readYoungHomeActivityFacts(
  today: Date,
  limit: number,
): Promise<YoungHomeActivity[]> {
  if (
    !Number.isFinite(today.getTime()) ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 50
  )
    throw new RangeError("Invalid home activity bounds");
  const localDate = (column: "startAt" | "endAt") =>
    `("${column}" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')::date`;
  return withRuntimeDatabaseAdapter("app", async (adapter) => {
    const groups = await Promise.all(
      [false, true].map(async (crossDay) => {
        const eligibility = crossDay
          ? `"endAt" > $1::timestamp AND ${localDate("endAt")} > ${localDate("startAt")}`
          : `"startAt" >= $1::timestamp AND ("endAt" IS NULL OR ("endAt" >= "startAt" AND ${localDate("endAt")} = ${localDate("startAt")}))`;
        const result = await adapter.queryRaw({
          sql: `SELECT "youngId", "name", "startAt", "endAt", "location", "organizer" FROM "YoungEvent" WHERE "isActive" = true AND "startAt" IS NOT NULL AND ${eligibility} ORDER BY "startAt" ASC, "youngId" ASC LIMIT $2::integer`,
          args: [today.toISOString(), limit],
          argTypes: [
            { scalarType: "string", arity: "scalar" },
            { scalarType: "int", arity: "scalar" },
          ],
        });
        return (result.rows as ActivityRow[]).map(
          ([youngId, name, startAt, endAt, location, organizer]) => ({
            youngId,
            name,
            startAt: timestamp(startAt),
            endAt: endAt == null ? null : timestamp(endAt),
            location,
            organizer,
            crossDay,
          }),
        );
      }),
    );
    return groups.flat();
  });
}

export function readYoungHomeActivities(today: Date, limit: number) {
  return cachedCatalogRuntimeData(
    "catalog:young-events-list",
    JSON.stringify({
      shape: "home-date-groups-v1",
      today: today.toISOString(),
      limit,
    }),
    getCanonicalOrigin(),
    () => readYoungHomeActivityFacts(today, limit),
  );
}
