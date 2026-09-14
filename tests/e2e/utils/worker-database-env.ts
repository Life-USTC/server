import {
  createTestPrisma,
  disconnectTestPrisma,
  type TestPrismaClient,
} from "../../shared/prisma";

const OWNER_DATABASE_ENV = "FUNCTION_OWNER_DATABASE_URL";

const runtimeConnections = [
  {
    env: "DATABASE_URL",
    hyperdrive: "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE",
    role: "life_ustc_runtime",
  },
  {
    env: "AUTH_DATABASE_URL",
    hyperdrive: "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH",
    role: "life_ustc_auth_runtime",
  },
  {
    env: "MAINTENANCE_DATABASE_URL",
    hyperdrive:
      "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_MAINTENANCE",
    role: "life_ustc_maintenance_runtime",
  },
] as const;

export type WorkerDatabaseEnvironment = {
  [OWNER_DATABASE_ENV]: string;
  DATABASE_URL: string;
  AUTH_DATABASE_URL: string;
  MAINTENANCE_DATABASE_URL: string;
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: string;
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH: string;
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_MAINTENANCE: string;
};

function requireEnvironmentValue(
  input: NodeJS.ProcessEnv,
  name: string,
): string {
  const value = input[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required for real Worker tests; source tests/ci/setup-runtime-database.sh first`,
    );
  }
  return value;
}

/**
 * Resolve the only database topology accepted by REST and browser Worker
 * tests. The owner URL is deliberately returned for the test process, but is
 * removed by getWorkerProcessEnvironment before Wrangler starts.
 */
export function resolveWorkerDatabaseEnvironment(
  input: NodeJS.ProcessEnv = process.env,
): WorkerDatabaseEnvironment {
  const owner = requireEnvironmentValue(input, OWNER_DATABASE_ENV);
  const environment = {
    [OWNER_DATABASE_ENV]: owner,
    DATABASE_URL: requireEnvironmentValue(input, "DATABASE_URL"),
    AUTH_DATABASE_URL: requireEnvironmentValue(input, "AUTH_DATABASE_URL"),
    MAINTENANCE_DATABASE_URL: requireEnvironmentValue(
      input,
      "MAINTENANCE_DATABASE_URL",
    ),
    CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:
      requireEnvironmentValue(
        input,
        "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE",
      ),
    CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH:
      requireEnvironmentValue(
        input,
        "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH",
      ),
    CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_MAINTENANCE:
      requireEnvironmentValue(
        input,
        "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_MAINTENANCE",
      ),
  } satisfies WorkerDatabaseEnvironment;

  const runtimeValues = runtimeConnections.map(({ env, hyperdrive }) => ({
    env,
    hyperdrive,
    value: environment[env],
    hyperdriveValue: environment[hyperdrive],
  }));

  const ownerMatches = runtimeValues
    .filter(({ value, hyperdriveValue }) =>
      [value, hyperdriveValue].includes(owner),
    )
    .flatMap(
      ({ env, hyperdrive, value, hyperdriveValue }) =>
        [
          [env, value],
          [hyperdrive, hyperdriveValue],
        ] as const,
    )
    .filter(([, value]) => value === owner)
    .map(([name]) => name);
  if (ownerMatches.length > 0) {
    throw new Error(
      `${ownerMatches.join(", ")} must not use ${OWNER_DATABASE_ENV}; the Worker may only receive restricted runtime URLs`,
    );
  }

  const mismatchedHyperdrives = runtimeValues.filter(
    ({ value, hyperdriveValue }) => value !== hyperdriveValue,
  );
  if (mismatchedHyperdrives.length > 0) {
    throw new Error(
      `Worker Hyperdrive URL mapping is invalid: ${mismatchedHyperdrives
        .map(({ env, hyperdrive }) => `${hyperdrive} must equal ${env}`)
        .join(", ")}`,
    );
  }

  const distinctRuntimeUrls = new Set(runtimeValues.map(({ value }) => value));
  if (distinctRuntimeUrls.size !== runtimeConnections.length) {
    throw new Error(
      "DATABASE_URL, AUTH_DATABASE_URL, and MAINTENANCE_DATABASE_URL must be three distinct restricted runtime URLs",
    );
  }

  return environment;
}

/**
 * Build Wrangler's process environment while keeping the elevated fixture
 * connection in the Playwright process only.
 */
export function getWorkerProcessEnvironment(
  input: NodeJS.ProcessEnv = process.env,
) {
  const environment = resolveWorkerDatabaseEnvironment(input);
  const { [OWNER_DATABASE_ENV]: _owner, ...withoutOwner } = input;
  const { [OWNER_DATABASE_ENV]: _resolvedOwner, ...runtimeEnvironment } =
    environment;
  return {
    ...withoutOwner,
    ...runtimeEnvironment,
  };
}

type RoleProbe = {
  bypassRls: boolean;
  currentUser: string;
  inheritedRoles: string[];
  ownsPublicTable: boolean;
  sessionUser: string;
  superuser: boolean;
};

async function readRoleProbe(client: TestPrismaClient) {
  const [role] = await client.$queryRaw<RoleProbe[]>`
    SELECT
      current_user AS "currentUser",
      session_user AS "sessionUser",
      role_row.rolsuper AS "superuser",
      role_row.rolbypassrls AS "bypassRls",
      COALESCE(
        ARRAY(
          SELECT parent.rolname::text
          FROM pg_catalog.pg_auth_members AS membership
          JOIN pg_catalog.pg_roles AS parent
            ON parent.oid = membership.roleid
          WHERE membership.member = role_row.oid
          ORDER BY parent.rolname
        ),
        ARRAY[]::text[]
      ) AS "inheritedRoles",
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
          AND relation.relowner = role_row.oid
      ) AS "ownsPublicTable"
    FROM pg_catalog.pg_roles AS role_row
    WHERE role_row.rolname = current_user
  `;
  return role;
}

/**
 * Check the effective roles behind all three Worker bindings before tests
 * run. URL strings alone cannot catch a copied password or a role with
 * elevated attributes, so this probe intentionally reads pg_catalog.
 */
export async function validateWorkerDatabaseRoles(
  input: NodeJS.ProcessEnv = process.env,
) {
  const environment = resolveWorkerDatabaseEnvironment(input);
  const clients = runtimeConnections.map(({ env }) =>
    createTestPrisma(environment[env]),
  );
  const ownerClient = createTestPrisma(environment[OWNER_DATABASE_ENV]);

  try {
    const runtimeRoles = await Promise.all(clients.map(readRoleProbe));
    for (const [index, actual] of runtimeRoles.entries()) {
      const expected = runtimeConnections[index].role;
      if (
        !actual ||
        actual.currentUser !== expected ||
        actual.sessionUser !== expected ||
        actual.superuser ||
        actual.bypassRls ||
        actual.inheritedRoles.length > 0 ||
        actual.ownsPublicTable
      ) {
        throw new Error(
          `${runtimeConnections[index].env} must connect as standalone non-superuser, non-bypass role ${expected} with no public table ownership; got ${actual?.currentUser ?? "no role"}`,
        );
      }
    }

    const ownerRole = await readRoleProbe(ownerClient);
    if (
      !ownerRole ||
      runtimeConnections.some(({ role }) => ownerRole.currentUser === role)
    ) {
      throw new Error(
        `${OWNER_DATABASE_ENV} must be an independent fixture connection; got ${ownerRole?.currentUser ?? "no role"}`,
      );
    }
  } finally {
    await Promise.all([
      ...clients.map((client) => disconnectTestPrisma(client)),
      disconnectTestPrisma(ownerClient),
    ]);
  }
}
