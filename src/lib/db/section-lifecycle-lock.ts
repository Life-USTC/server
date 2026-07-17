// Both interactive subscription writes and the static loader use this namespace.
const SECTION_LIFECYCLE_LOCK_NAMESPACE = "life-ustc-section-lifecycle";

type AdvisoryLockTransaction = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

export async function acquireSectionLifecycleAdvisoryLocks(
  tx: AdvisoryLockTransaction,
  sectionIds: readonly number[],
  mode: "exclusive" | "shared",
) {
  const ids = [...new Set(sectionIds)].sort((left, right) => left - right);
  if (ids.length === 0) return;

  const placeholders = ids.map((_, index) => `$${index + 2}`).join(",");
  const lockFunction =
    mode === "shared"
      ? "pg_advisory_xact_lock_shared"
      : "pg_advisory_xact_lock";
  await tx.$queryRawUnsafe(
    `WITH lock_ids AS MATERIALIZED (
       SELECT "id"
       FROM unnest(ARRAY[${placeholders}]::integer[]) AS ids("id")
       ORDER BY "id"
     )
     SELECT ${lockFunction}(hashtext($1), "id")::text AS "acquired"
     FROM lock_ids
     ORDER BY "id"`,
    SECTION_LIFECYCLE_LOCK_NAMESPACE,
    ...ids,
  );
}
