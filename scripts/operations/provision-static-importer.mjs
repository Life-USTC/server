import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const migratorUrl = required("MIGRATOR_DATABASE_URL");
const repository = required("GITHUB_REPOSITORY");
required("GH_TOKEN");
const password = randomBytes(32).toString("base64url");
const importerUrl = new URL(migratorUrl);
importerUrl.username = "life_ustc_importer";
importerUrl.password = password;
const secret = importerUrl.toString();
const secretResult = spawnSync(
  "gh",
  ["secret", "set", "IMPORTER_DATABASE_URL", "--repo", repository],
  { input: secret, stdio: ["pipe", "inherit", "inherit"] },
);
if (secretResult.error || secretResult.status !== 0) {
  throw new Error("Unable to provision IMPORTER_DATABASE_URL");
}

const owner = new pg.Client({ connectionString: migratorUrl });
try {
  await owner.connect();
  await owner.query("BEGIN");
  await owner.query(
    "SELECT pg_advisory_xact_lock(hashtext('life-ustc'), hashtext('static-importer-provisioning'))",
  );
  await owner.query(
    "DO $provision$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_importer') THEN CREATE ROLE life_ustc_importer NOLOGIN; END IF; END $provision$",
  );
  await owner.query(
    "ALTER ROLE life_ustc_importer NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT NOBYPASSRLS LOGIN PASSWORD '" +
      password +
      "'",
  );
  await owner.query(
    readFileSync("prisma/roles/importer-table-grants.sql", "utf8"),
  );
  await owner.query("COMMIT");
} catch (error) {
  await owner.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await owner.end();
}

const importer = new pg.Client({ connectionString: secret });
try {
  await importer.connect();
  const result = await importer.query(
    "SELECT current_user AS name, session_user AS session",
  );
  if (
    result.rows[0]?.name !== "life_ustc_importer" ||
    result.rows[0]?.session !== "life_ustc_importer"
  ) {
    throw new Error("Importer identity verification failed");
  }
  console.log("Static importer credential and role grants verified.");
} finally {
  await importer.end();
}
