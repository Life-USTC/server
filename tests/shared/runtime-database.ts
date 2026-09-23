import {
  createTestPrisma,
  disconnectTestPrisma,
  type TestPrismaClient,
} from "./prisma";

type RoleProbe = {
  bypassRls: boolean;
  currentUser: string;
  hasRoleMembership: boolean;
  inherit: boolean;
  ownsPublicRelation: boolean;
  sessionUser: string;
  superuser: boolean;
};

type DatabaseTarget = {
  database: string;
  host: string;
  port: string;
};

export const runtimeDatabaseConnections = [
  { env: "DATABASE_URL", role: "life_ustc_runtime" },
  { env: "AUTH_DATABASE_URL", role: "life_ustc_auth_runtime" },
  { env: "MAINTENANCE_DATABASE_URL", role: "life_ustc_maintenance_runtime" },
] as const;

export const functionOwnerDatabaseEnv = "FUNCTION_OWNER_DATABASE_URL";

function requiredEnv(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required for integration tests`);
  return value;
}

function databaseTarget(connectionString: string, envName: string) {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(`${envName} must be a valid PostgreSQL connection URL`);
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    !url.pathname ||
    url.pathname === "/"
  ) {
    throw new Error(`${envName} must include a database host and name`);
  }
  return {
    database: decodeURIComponent(url.pathname.slice(1)),
    host: url.hostname.toLowerCase(),
    port: url.port || "5432",
  } satisfies DatabaseTarget;
}

function sameDatabaseTarget(left: DatabaseTarget, right: DatabaseTarget) {
  return (
    left.database === right.database &&
    left.host === right.host &&
    left.port === right.port
  );
}

function describeDatabaseTarget(target: DatabaseTarget) {
  return `${target.host}:${target.port}/${target.database}`;
}

async function readCurrentRole(client: TestPrismaClient) {
  const [role] = await client.$queryRaw<RoleProbe[]>`
    SELECT
      current_user AS "currentUser",
      session_user AS "sessionUser",
      rolsuper AS superuser,
      rolbypassrls AS "bypassRls",
      rolinherit AS inherit,
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_auth_members AS membership
        JOIN pg_catalog.pg_roles AS member_role
          ON member_role.oid = membership.member
        WHERE member_role.rolname = current_user
      ) AS "hasRoleMembership",
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        JOIN pg_catalog.pg_roles AS owner_role
          ON owner_role.oid = relation.relowner
        WHERE namespace.nspname = 'public'
          AND owner_role.rolname = current_user
      ) AS "ownsPublicRelation"
    FROM pg_catalog.pg_roles
    WHERE rolname = current_user
  `;
  return role;
}

/**
 * Check the three database connections used by the deployed application.
 * Calling this from a test runner setup makes a postgres URL fail before a
 * test can accidentally pass because it bypasses RLS.
 */
export async function validateRuntimeDatabaseRoles(
  env: NodeJS.ProcessEnv = process.env,
) {
  const runtimeUrls = runtimeDatabaseConnections.map(({ env: name }) => ({
    name,
    target: databaseTarget(requiredEnv(env, name), name),
  }));
  const firstTarget = runtimeUrls[0]?.target;
  if (!firstTarget)
    throw new Error("No runtime database connections configured");
  for (const { name, target } of runtimeUrls.slice(1)) {
    if (!sameDatabaseTarget(firstTarget, target)) {
      throw new Error(
        `${name} must target the same database as DATABASE_URL (${describeDatabaseTarget(firstTarget)}); got ${describeDatabaseTarget(target)}`,
      );
    }
  }

  const clients = runtimeUrls.map(({ name }) =>
    createTestPrisma(requiredEnv(env, name)),
  );

  try {
    const roles = await Promise.all(
      clients.map((client) => readCurrentRole(client)),
    );
    for (const [index, actual] of roles.entries()) {
      const expected = runtimeDatabaseConnections[index].role;
      if (
        !actual ||
        actual.currentUser !== expected ||
        actual.sessionUser !== expected ||
        actual.superuser ||
        actual.bypassRls ||
        actual.inherit ||
        actual.hasRoleMembership ||
        actual.ownsPublicRelation
      ) {
        throw new Error(
          `${runtimeDatabaseConnections[index].env} must connect as non-superuser, non-bypass, non-inheriting role ${expected} with no role memberships or public-schema ownership; got ${actual?.currentUser ?? "no role"}`,
        );
      }
    }
  } finally {
    await Promise.all(clients.map((client) => disconnectTestPrisma(client)));
  }
}

/**
 * Check runtime connections and the separate elevated fixture connection used
 * only by test setup/cleanup.
 */
export async function validateIntegrationDatabaseRoles(
  env: NodeJS.ProcessEnv = process.env,
) {
  await validateRuntimeDatabaseRoles(env);
  const runtimeUrl = requiredEnv(env, runtimeDatabaseConnections[0].env);
  const runtimeTarget = databaseTarget(
    runtimeUrl,
    runtimeDatabaseConnections[0].env,
  );
  const ownerUrl = requiredEnv(env, functionOwnerDatabaseEnv);
  const ownerTarget = databaseTarget(ownerUrl, functionOwnerDatabaseEnv);
  if (!sameDatabaseTarget(runtimeTarget, ownerTarget)) {
    throw new Error(
      `${functionOwnerDatabaseEnv} must target the same database as the runtime connections (${describeDatabaseTarget(runtimeTarget)}); got ${describeDatabaseTarget(ownerTarget)}`,
    );
  }
  const ownerClient = createTestPrisma(ownerUrl);
  try {
    const ownerRole = await readCurrentRole(ownerClient);
    if (
      !ownerRole ||
      runtimeDatabaseConnections.some(
        ({ role }) =>
          ownerRole.currentUser === role || ownerRole.sessionUser === role,
      )
    ) {
      throw new Error(
        `${functionOwnerDatabaseEnv} must be an independent fixture connection; got ${ownerRole?.currentUser ?? "no role"}`,
      );
    }
  } finally {
    await disconnectTestPrisma(ownerClient);
  }
}
