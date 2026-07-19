import type { SupportedOAuthClientAuthMethod } from "@/lib/oauth/constants";
import type {
  AuditLogCleanupInput,
  AuditLogCleanupTarget,
} from "../../shared/audit-cleanup";
import * as auditFixtures from "./e2e-db/audit";
import * as busFixtures from "./e2e-db/bus";
import * as catalogFixtures from "./e2e-db/catalog";
import * as oauthFixtures from "./e2e-db/oauth";
import * as seedFixtures from "./e2e-db/seed";
import * as userFixtures from "./e2e-db/users";

export { getCurrentSessionUser, PLAYWRIGHT_BASE_URL } from "./e2e-db/core";

const DB_FIXTURE_ATTEMPTS = 3;

const operations = {
  createTempCoursesFixture: catalogFixtures.createTempCoursesFixture,
  createOAuthClientFixture: oauthFixtures.createOAuthClientFixture,
  cleanupAuditLogsForE2e: auditFixtures.cleanupAuditLogsForE2e,
  cleanupAuditTargetsForE2e: auditFixtures.cleanupAuditTargetsForE2e,
  isolateSingleActiveBusTripFixture:
    busFixtures.isolateSingleActiveBusTripFixture,
  restoreBusTripTimesFixture: busFixtures.restoreBusTripTimesFixture,
  deleteLinkedAccountFixture: oauthFixtures.deleteLinkedAccountFixture,
  deleteTempCoursesByPrefix: catalogFixtures.deleteTempCoursesByPrefix,
  deleteOAuthClientsByName: oauthFixtures.deleteOAuthClientsByName,
  disableOAuthClientByName: oauthFixtures.disableOAuthClientByName,
  ensureLinkedAccountFixture: oauthFixtures.ensureLinkedAccountFixture,
  getSeedCourseFilterFixture: seedFixtures.getSeedCourseFilterFixture,
  getSeedSectionSemesterFixture: seedFixtures.getSeedSectionSemesterFixture,
  getSeedTeacherDepartmentFixture: seedFixtures.getSeedTeacherDepartmentFixture,
  ensureUserCalendarFeedFixture: userFixtures.ensureUserCalendarFeedFixture,
  getUserProfileById: userFixtures.getUserProfileById,
  createTempUsersFixture: userFixtures.createTempUsersFixture,
  deleteUsersByPrefix: userFixtures.deleteUsersByPrefix,
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

export const cleanupAuditLogsForE2e = (input: AuditLogCleanupInput) =>
  runDbFixture<void>("cleanupAuditLogsForE2e", [input]);

export const cleanupAuditTargetsForE2e = (
  targets: readonly AuditLogCleanupTarget[],
) => runDbFixture<void>("cleanupAuditTargetsForE2e", [targets]);

export const isolateSingleActiveBusTripFixture = (
  stopTimes: [string, string],
) =>
  runDbFixture<busFixtures.BusTripTimesSnapshot>(
    "isolateSingleActiveBusTripFixture",
    [stopTimes],
  );

export const restoreBusTripTimesFixture = (
  snapshot: busFixtures.BusTripTimesSnapshot,
) => runDbFixture<void>("restoreBusTripTimesFixture", [snapshot]);

export const createTempCoursesFixture = (options: {
  count: number;
  prefix: string;
}) => runDbFixture<{ count: number }>("createTempCoursesFixture", [options]);

export const deleteTempCoursesByPrefix = (prefix: string) =>
  runDbFixture<void>("deleteTempCoursesByPrefix", [prefix]);

export const deleteOAuthClientsByName = (name: string) =>
  runDbFixture<null>("deleteOAuthClientsByName", [name]);

export const disableOAuthClientByName = (name: string) =>
  runDbFixture<null>("disableOAuthClientByName", [name]);

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
  runDbFixture<{
    code: string;
    id: number;
    semesterId: number | null;
    semesterName: string | null;
  }>("getSeedSectionSemesterFixture", [jwId]);

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
}) =>
  runDbFixture<{ userIds: string[]; usernames: string[] }>(
    "createTempUsersFixture",
    [options],
  );

export const deleteUsersByPrefix = (prefix: string) =>
  runDbFixture<null>("deleteUsersByPrefix", [prefix]);
