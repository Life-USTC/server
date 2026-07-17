import type { AdminClassBuild } from "./identity-types";

export type AdminClassIdentityPlan = {
  canonicalBuilds: AdminClassBuild[];
  canonicalJwIdByAlias: Map<number, number>;
};

export function canonicalizeAdminClasses(
  builds: AdminClassBuild[],
): AdminClassIdentityPlan {
  const sorted = [...builds].sort(
    (left, right) =>
      left.nameCn.localeCompare(right.nameCn) || left.jwId - right.jwId,
  );
  const canonicalByName = new Map<string, AdminClassBuild>();
  const canonicalJwIdByAlias = new Map<number, number>();

  for (const build of sorted) {
    const canonical = canonicalByName.get(build.nameCn) ?? build;
    canonicalByName.set(build.nameCn, canonical);
    canonicalJwIdByAlias.set(build.jwId, canonical.jwId);
  }

  return {
    canonicalBuilds: [...canonicalByName.values()].sort(
      (left, right) => left.jwId - right.jwId,
    ),
    canonicalJwIdByAlias: new Map(
      [...canonicalJwIdByAlias].sort(
        ([leftAlias], [rightAlias]) => leftAlias - rightAlias,
      ),
    ),
  };
}
