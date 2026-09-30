import type { SupportedOAuthClientAuthMethod } from "@/lib/oauth/constants";
import * as oauthFixtures from "./e2e-db/oauth";
import * as seedFixtures from "./e2e-db/seed";

export { getCurrentSessionUser, PLAYWRIGHT_BASE_URL } from "./e2e-db/core";

const DB_FIXTURE_ATTEMPTS = 3;

const operations = {
  createOAuthClientFixture: oauthFixtures.createOAuthClientFixture,
  deleteOAuthClientsByName: oauthFixtures.deleteOAuthClientsByName,
  getSeedCourseFilterFixture: seedFixtures.getSeedCourseFilterFixture,
  getSeedSectionSemesterFixture: seedFixtures.getSeedSectionSemesterFixture,
  getSeedTeacherDepartmentFixture: seedFixtures.getSeedTeacherDepartmentFixture,
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

export const getSeedCourseFilterFixture = (jwId: number) =>
  runDbFixture<{
    educationLevelId: number | null;
    educationLevelName: string | null;
    categoryId: number | null;
    categoryName: string | null;
    classTypeId: number | null;
    classTypeName: string | null;
  }>("getSeedCourseFilterFixture", [jwId]);

export const getSeedTeacherDepartmentFixture = (jwId: number) =>
  runDbFixture<{ departmentId: number | null; departmentName: string | null }>(
    "getSeedTeacherDepartmentFixture",
    [jwId],
  );

export const getSeedSectionSemesterFixture = (jwId: number) =>
  runDbFixture<{
    code: string;
    id: number;
    semesterId: number | null;
    semesterName: string | null;
  }>("getSeedSectionSemesterFixture", [jwId]);
