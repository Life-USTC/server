import { test } from "vitest";
import {
  createDatabaseTemplate,
  createIsolatedDatabase,
  type DatabaseTemplate,
  databaseConnectionsFromEnvironment,
  type IsolatedDatabase,
} from "./isolated-database-lifecycle";

export type { IsolatedDatabase } from "./isolated-database-lifecycle";

/** Vitest lifecycle adapter; Worker/browser tests share the same DB factory. */
export const isolatedDatabaseTest = test.extend<{
  $file: { databaseTemplate: DatabaseTemplate };
  $test: { isolatedDatabase: IsolatedDatabase };
}>({
  databaseTemplate: [
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies.
    async ({}, use) => {
      const template = await createDatabaseTemplate(
        databaseConnectionsFromEnvironment(process.env),
      );
      try {
        await use(template);
      } finally {
        await template.dispose();
      }
    },
    { scope: "file" },
  ],
  isolatedDatabase: async ({ databaseTemplate }, use) => {
    const database = await createIsolatedDatabase(databaseTemplate);
    try {
      await use(database);
    } finally {
      await database.dispose();
    }
  },
});
