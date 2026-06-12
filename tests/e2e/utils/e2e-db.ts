import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { SupportedOAuthClientAuthMethod } from "@/lib/oauth/constants";
import * as oauthFixtures from "./e2e-db/oauth";
import * as seedFixtures from "./e2e-db/seed";
import * as userFixtures from "./e2e-db/users";

export { getCurrentSessionUser, PLAYWRIGHT_BASE_URL } from "./e2e-db/core";

const DB_FIXTURE_ATTEMPTS = 3;

const operations = {
  createOAuthClientFixture: oauthFixtures.createOAuthClientFixture,
  deleteLinkedAccountFixture: oauthFixtures.deleteLinkedAccountFixture,
  deleteOAuthClientsByName: oauthFixtures.deleteOAuthClientsByName,
  ensureLinkedAccountFixture: oauthFixtures.ensureLinkedAccountFixture,
  getSeedCourseFilterFixture: seedFixtures.getSeedCourseFilterFixture,
  getSeedSectionSemesterFixture: seedFixtures.getSeedSectionSemesterFixture,
  getSeedTeacherDepartmentFixture: seedFixtures.getSeedTeacherDepartmentFixture,
  ensureUserCalendarFeedFixture: userFixtures.ensureUserCalendarFeedFixture,
  getUserProfileById: userFixtures.getUserProfileById,
  getUserSubscribedSectionIds: userFixtures.getUserSubscribedSectionIds,
  replaceUserSubscribedSectionIds: userFixtures.replaceUserSubscribedSectionIds,
  updateUserProfileById: userFixtures.updateUserProfileById,
};

async function runDbFixture<T>(operation: string, args: unknown[] = []) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DB_FIXTURE_ATTEMPTS; attempt += 1) {
    try {
      const fn = operations[operation as keyof typeof operations];
      if (!fn) {
        throw new Error(`Unknown E2E DB fixture operation: ${operation}`);
      }
      return (await (fn as (...input: unknown[]) => Promise<unknown>)(
        ...args,
      )) as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function createFixturePool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for E2E DB fixtures");
  }

  return new Pool({ connectionString, max: 1 });
}

async function withFixturePool<T>(callback: (pool: Pool) => Promise<T>) {
  const pool = createFixturePool();
  try {
    return await callback(pool);
  } finally {
    await pool.end();
  }
}

async function createTempUsersFixtureDirect(options: {
  prefix: string;
  count: number;
}) {
  const usernames: string[] = [];

  await withFixturePool(async (pool) => {
    for (let index = 0; index < options.count; index += 1) {
      const username = `${options.prefix}-${String(index).padStart(2, "0")}`;
      const email = `${username}@users.local`;
      usernames.push(username);

      const userResult = await pool.query<{ id: string }>(
        `
          INSERT INTO "User" ("id", "username", "email", "emailVerified", "name", "updatedAt")
          VALUES ($1, $2, $3, TRUE, $4, NOW())
          ON CONFLICT ("username") DO UPDATE
          SET "email" = EXCLUDED."email",
              "emailVerified" = TRUE,
              "name" = EXCLUDED."name",
              "updatedAt" = NOW()
          RETURNING "id"
        `,
        [randomUUID(), username, email, `E2E ${username}`],
      );

      const userId = userResult.rows[0]?.id;
      if (!userId) {
        throw new Error(`Failed to create E2E user fixture: ${username}`);
      }

      await pool.query(
        `
          INSERT INTO "VerifiedEmail" ("email", "provider", "userId", "updatedAt")
          VALUES ($1, 'oidc', $2, NOW())
          ON CONFLICT ("provider", "email") DO UPDATE
          SET "userId" = EXCLUDED."userId",
              "updatedAt" = NOW()
        `,
        [`${username}@example.test`, userId],
      );
    }
  });

  return { usernames };
}

async function deleteUsersByPrefixDirect(prefix: string) {
  await withFixturePool(async (pool) => {
    await pool.query('DELETE FROM "User" WHERE "username" LIKE $1', [
      `${prefix}%`,
    ]);
  });
}

type OAuthClientFixtureOptions = {
  name?: string;
  redirectUris?: string[];
  scopes?: string[];
  grantTypes?: string[];
  clientId?: string;
  clientSecret?: string;
  tokenEndpointAuthMethod?: SupportedOAuthClientAuthMethod;
};

type LinkedAccountFixtureOptions = {
  userId: string;
  provider: "github" | "google" | "oidc";
  providerAccountId?: string;
  email?: string;
};

type UserProfileFixture = {
  name: string;
  username: string | null;
  image: string | null;
};

type UserProfileUpdateFixture = {
  name?: string | null;
  username?: string | null;
  image?: string | null;
};

export const createOAuthClientFixture = (options?: OAuthClientFixtureOptions) =>
  runDbFixture<{
    id: string;
    clientId: string;
    name: string;
    clientSecret: string | null;
    tokenEndpointAuthMethod: string;
    redirectUris: string[];
    scopes: string[];
  }>("createOAuthClientFixture", [options]);

export const deleteOAuthClientsByName = (name: string) =>
  runDbFixture<null>("deleteOAuthClientsByName", [name]);

export const ensureLinkedAccountFixture = (
  options: LinkedAccountFixtureOptions,
) =>
  runDbFixture<{
    provider: string;
    providerAccountId: string;
    email: string;
  }>("ensureLinkedAccountFixture", [options]);

export const deleteLinkedAccountFixture = (options: {
  userId: string;
  provider: string;
}) => runDbFixture<null>("deleteLinkedAccountFixture", [options]);

export const getSeedCourseFilterFixture = (jwId: number) =>
  runDbFixture<{
    educationLevelId: number | null;
    educationLevelName: string | null;
    categoryId: number | null;
    categoryName: string | null;
    classTypeId: number | null;
    classTypeName: string | null;
  }>("getSeedCourseFilterFixture", [jwId]);

export const getSeedTeacherDepartmentFixture = (code: string) =>
  runDbFixture<{ departmentId: number | null; departmentName: string | null }>(
    "getSeedTeacherDepartmentFixture",
    [code],
  );

export const getSeedSectionSemesterFixture = (jwId: number) =>
  runDbFixture<{ semesterId: number | null; semesterName: string | null }>(
    "getSeedSectionSemesterFixture",
    [jwId],
  );

export const getUserProfileById = (userId: string) =>
  runDbFixture<UserProfileFixture>("getUserProfileById", [userId]);

export const ensureUserCalendarFeedFixture = (userId: string) =>
  runDbFixture<{ userId: string; token: string; path: string }>(
    "ensureUserCalendarFeedFixture",
    [userId],
  );

export const updateUserProfileById = (
  userId: string,
  data: UserProfileUpdateFixture,
) => runDbFixture<null>("updateUserProfileById", [userId, data]);

export const getUserSubscribedSectionIds = (userId: string) =>
  runDbFixture<number[]>("getUserSubscribedSectionIds", [userId]);

export const replaceUserSubscribedSectionIds = (
  userId: string,
  sectionIds: number[],
) =>
  runDbFixture<null>("replaceUserSubscribedSectionIds", [userId, sectionIds]);

export const createTempUsersFixture = (options: {
  prefix: string;
  count: number;
}) => createTempUsersFixtureDirect(options);

export const deleteUsersByPrefix = (prefix: string) =>
  deleteUsersByPrefixDirect(prefix);
