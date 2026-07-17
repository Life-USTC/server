import { describe, expect, it } from "vitest";
import {
  createPersistedGraphqlOperationRegistry,
  createPublicGraphqlOperationsManifest,
  publicGraphqlOperationsManifest,
} from "@/lib/graphql/operations";

describe("persisted GraphQL operation registry", () => {
  it("publishes a stable typed envelope while the registry has no callers", () => {
    expect(publicGraphqlOperationsManifest).toEqual({
      schemaVersion: 1,
      operations: [],
    });
    expect(Object.isFrozen(publicGraphqlOperationsManifest)).toBe(true);
    expect(Object.isFrozen(publicGraphqlOperationsManifest.operations)).toBe(
      true,
    );
  });

  it("derives safe public metadata without publishing operation documents", () => {
    const registry = createPersistedGraphqlOperationRegistry([
      {
        id: "viewer_overview.v1",
        title: "Viewer overview",
        description: "Reads the current viewer overview.",
        document: "query ViewerOverview { currentSemester { jwId } }",
        scopes: ["user:read"],
        readOnly: true,
        destructive: false,
        requiresConfirmation: false,
      },
    ]);

    expect(createPublicGraphqlOperationsManifest(registry)).toEqual({
      schemaVersion: 1,
      operations: [
        {
          id: "viewer_overview.v1",
          title: "Viewer overview",
          description: "Reads the current viewer overview.",
          scopes: ["user:read"],
          readOnly: true,
          destructive: false,
          requiresConfirmation: false,
          operationName: "ViewerOverview",
          operationType: "query",
        },
      ],
    });
    expect(
      createPublicGraphqlOperationsManifest(registry).operations[0],
    ).not.toHaveProperty("document");
  });

  it("rejects duplicate IDs and inconsistent safety metadata", () => {
    const base = {
      id: "catalog.v1",
      title: "Catalog",
      description: "Reads catalog data.",
      document: "query Catalog { currentSemester { jwId } }",
      scopes: [] as string[],
      readOnly: true,
      destructive: false,
      requiresConfirmation: false,
    };

    expect(() => createPersistedGraphqlOperationRegistry([base, base])).toThrow(
      'duplicate id "catalog.v1"',
    );
    expect(() =>
      createPersistedGraphqlOperationRegistry([
        { ...base, destructive: true, requiresConfirmation: true },
      ]),
    ).toThrow("marks a query as destructive");
  });
});
