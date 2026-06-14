import {
  createOAuthClientFixture,
  deleteLinkedAccountFixture,
  deleteOAuthClientsByName,
  ensureLinkedAccountFixture,
} from "./oauth";
import {
  getSeedCourseFilterFixture,
  getSeedSectionSemesterFixture,
  getSeedTeacherDepartmentFixture,
} from "./seed";
import {
  createTempUsersFixture,
  deleteUsersByPrefix,
  ensureUserCalendarFeedFixture,
  getUserProfileById,
  getUserSubscribedSectionIds,
  replaceUserSubscribedSectionIds,
  updateUserProfileById,
} from "./users";

const operations = {
  createOAuthClientFixture,
  deleteLinkedAccountFixture,
  deleteOAuthClientsByName,
  ensureLinkedAccountFixture,
  getSeedCourseFilterFixture,
  getSeedSectionSemesterFixture,
  getSeedTeacherDepartmentFixture,
  createTempUsersFixture,
  deleteUsersByPrefix,
  ensureUserCalendarFeedFixture,
  getUserProfileById,
  getUserSubscribedSectionIds,
  replaceUserSubscribedSectionIds,
  updateUserProfileById,
};

type OperationName = keyof typeof operations;

const operationName = process.argv[2] as OperationName | undefined;
const operation = operationName ? operations[operationName] : undefined;

if (!operationName || !operation) {
  console.error(`Unknown e2e DB fixture operation: ${operationName ?? ""}`);
  process.exit(1);
}

const args = JSON.parse(process.argv[3] ?? "[]") as unknown[];
const result = await (operation as (...args: unknown[]) => Promise<unknown>)(
  ...args,
);

process.stdout.write(`${JSON.stringify(result ?? null)}\n`);
