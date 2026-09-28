import { test } from "vitest";
import {
  type DatabaseTemplate,
  databaseConnectionsFromEnvironment,
  type IsolatedDatabase,
  type OwnedDatabase,
  type OwnedDatabaseTemplate,
  ownDatabaseTemplate,
  ownIsolatedDatabase,
} from "./isolated-database-lifecycle";

export type { IsolatedDatabase } from "./isolated-database-lifecycle";

/** Vitest lifecycle adapter; Worker/browser tests share the same DB factory. */
export const isolatedDatabaseTest = test.extend<{
  $file: {
    databaseTemplate: DatabaseTemplate;
    _templateResources: OwnedDatabaseTemplate;
  };
  $test: {
    isolatedDatabase: IsolatedDatabase;
    _databaseResources: OwnedDatabase;
  };
}>({
  _templateResources: [
    // biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies.
    async ({}, use) => {
      const template = ownDatabaseTemplate(
        databaseConnectionsFromEnvironment(process.env),
      );
      try {
        // Vitest registers teardown inside use(), before a dependent can time out.
        await use(template);
      } finally {
        await template.dispose();
      }
    },
    { scope: "file" },
  ],
  databaseTemplate: [
    async ({ _templateResources }, use) => {
      await _templateResources.initialize();
      await use(_templateResources);
    },
    { scope: "file" },
  ],
  _databaseResources: async ({ databaseTemplate }, use) => {
    const database = ownIsolatedDatabase(databaseTemplate);
    try {
      await use(database);
    } finally {
      await database.dispose();
    }
  },
  isolatedDatabase: async ({ _databaseResources }, use) => {
    await _databaseResources.initialize();
    await use(_databaseResources);
  },
});
