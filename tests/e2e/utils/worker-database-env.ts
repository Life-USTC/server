const OWNER_DATABASE_ENV = "FUNCTION_OWNER_DATABASE_URL";

const runtimeConnections = [
  {
    env: "DATABASE_URL",
    hyperdrive: "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE",
  },
  {
    env: "AUTH_DATABASE_URL",
    hyperdrive: "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_AUTH",
  },
  {
    env: "MAINTENANCE_DATABASE_URL",
    hyperdrive:
      "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_MAINTENANCE",
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
 * tests. The owner URL is deliberately retained for the test process and
 * omitted from the environment passed to the Worker launcher.
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
  return { ...withoutOwner, ...runtimeEnvironment };
}
