import { getOperationAST, Kind } from "graphql";
import { describe, expect, it } from "vitest";
import {
  createPersistedGraphqlOperationRegistry,
  createPublicGraphqlOperationsManifest,
  graphqlPersistedOperationRegistry,
  publicGraphqlOperationsManifest,
} from "@/lib/graphql/operations";
import { graphqlSchema } from "@/lib/graphql/schema";
import graphqlContract from "../../docs/contracts/graphql.json";
import mcpContract from "../../docs/contracts/mcp.json";

describe("persisted GraphQL operation registry", () => {
  it("publishes the complete approved root-field capability matrix", () => {
    const queryFields = Object.keys(
      graphqlSchema.getQueryType()?.getFields() ?? {},
    ).sort();
    const mutationFields = Object.keys(
      graphqlSchema.getMutationType()?.getFields() ?? {},
    ).sort();
    const registeredQueryFields = Array.from(
      new Set(
        graphqlPersistedOperationRegistry
          .filter((operation) => operation.operationType === "query")
          .map((operation) => operation.rootField),
      ),
    ).sort();
    const registeredMutationFields = graphqlPersistedOperationRegistry
      .filter((operation) => operation.operationType === "mutation")
      .map((operation) => operation.rootField)
      .sort();

    expect(registeredQueryFields).toEqual(queryFields);
    expect(registeredMutationFields).toEqual(mutationFields);
    expect(graphqlPersistedOperationRegistry).toHaveLength(44);
    expect(
      graphqlPersistedOperationRegistry.map((operation) => operation.id),
    ).toEqual(
      expect.arrayContaining([
        "todo.set_completions_batch.v1",
        "todo.delete_batch.v1",
        "homework.set_completions_batch.v1",
        "subscription.update_sections_batch.v1",
        "dashboard.set_link_pin_states_batch.v1",
        "comment.delete_batch.v1",
        "upload.create_session.v1",
        "upload.complete.v1",
        "upload.rename.v1",
        "upload.delete.v1",
      ]),
    );
    expect(
      graphqlPersistedOperationRegistry.filter(
        (operation) => operation.rootField === "viewer",
      ),
    ).toHaveLength(7);

    const viewerType = graphqlSchema.getType("Viewer") as
      | { getFields?: () => Record<string, unknown> }
      | undefined;
    if (typeof viewerType?.getFields !== "function") {
      throw new Error("Viewer must be a GraphQL object type");
    }
    const viewerFields = Object.keys(viewerType.getFields()).sort();
    const registeredViewerFields = graphqlPersistedOperationRegistry
      .filter((operation) => operation.rootField === "viewer")
      .map((operation) => {
        const operationAst = getOperationAST(
          operation.document,
          operation.operationName,
        );
        const rootSelection = operationAst?.selectionSet.selections[0];
        const viewerSelection =
          rootSelection?.kind === Kind.FIELD
            ? rootSelection.selectionSet?.selections[0]
            : undefined;
        if (viewerSelection?.kind !== Kind.FIELD) {
          throw new Error(`Invalid Viewer operation ${operation.id}`);
        }
        return viewerSelection.name.value;
      })
      .sort();
    expect(registeredViewerFields).toEqual(viewerFields);
  });

  it("publishes frozen safety metadata without operation documents", () => {
    expect(publicGraphqlOperationsManifest.schemaVersion).toBe(1);
    expect(publicGraphqlOperationsManifest.operations).toHaveLength(44);
    expect(Object.isFrozen(publicGraphqlOperationsManifest)).toBe(true);
    expect(Object.isFrozen(publicGraphqlOperationsManifest.operations)).toBe(
      true,
    );

    const createTodo = publicGraphqlOperationsManifest.operations.find(
      (operation) => operation.id === "todo.create.v1",
    );
    expect(createTodo).toEqual({
      id: "todo.create.v1",
      title: "Create todo",
      description: "Creates a todo owned by the authenticated viewer.",
      operationName: "TodoCreate",
      operationType: "mutation",
      rootField: "createTodo",
      variables: [{ name: "input", type: "CreateTodoInput!", required: true }],
      scopes: ["todo:write"],
      readOnly: false,
      destructive: false,
      openWorld: false,
      requiresConfirmation: true,
    });
    expect(createTodo).not.toHaveProperty("document");

    const updateTodo = publicGraphqlOperationsManifest.operations.find(
      (operation) => operation.id === "todo.update.v1",
    );
    expect(updateTodo).toMatchObject({
      readOnly: false,
      destructive: true,
      requiresConfirmation: true,
    });

    expect(
      Object.fromEntries(
        publicGraphqlOperationsManifest.operations
          .filter((operation) =>
            [
              "dashboard.set_link_pin_states_batch.v1",
              "comment.delete_batch.v1",
              "upload.create_session.v1",
              "upload.complete.v1",
              "upload.rename.v1",
              "upload.delete.v1",
            ].includes(operation.id),
          )
          .map((operation) => [
            operation.id,
            {
              destructive: operation.destructive,
              openWorld: operation.openWorld,
              requiresConfirmation: operation.requiresConfirmation,
              scopes: operation.scopes,
              variables: operation.variables.map((variable) => variable.name),
            },
          ]),
      ),
    ).toEqual({
      "dashboard.set_link_pin_states_batch.v1": {
        destructive: true,
        openWorld: false,
        requiresConfirmation: true,
        scopes: ["dashboard:write"],
        variables: ["items"],
      },
      "comment.delete_batch.v1": {
        destructive: true,
        openWorld: true,
        requiresConfirmation: true,
        scopes: ["comment:write"],
        variables: ["ids"],
      },
      "upload.create_session.v1": {
        destructive: false,
        openWorld: true,
        requiresConfirmation: true,
        scopes: ["upload:write"],
        variables: ["input"],
      },
      "upload.complete.v1": {
        destructive: false,
        openWorld: true,
        requiresConfirmation: true,
        scopes: ["upload:write"],
        variables: ["input"],
      },
      "upload.rename.v1": {
        destructive: true,
        openWorld: false,
        requiresConfirmation: true,
        scopes: ["upload:write"],
        variables: ["id", "filename"],
      },
      "upload.delete.v1": {
        destructive: true,
        openWorld: true,
        requiresConfirmation: true,
        scopes: ["upload:write"],
        variables: ["id"],
      },
    });
  });

  it("keeps the product contracts pointed at the registered runner", () => {
    expect(
      graphqlContract.capabilities["registered-operation-runner"].mcp.tools,
    ).toEqual([expect.objectContaining({ name: "run_graphql_operation" })]);
    expect(
      mcpContract.capabilities["tool-groups"].mcp.groups.flatMap(
        (group) => group.tools,
      ),
    ).toContain("run_graphql_operation");
  });

  it("derives variable and root-field metadata for custom definitions", () => {
    const registry = createPersistedGraphqlOperationRegistry([
      {
        id: "viewer_overview.v1",
        title: "Viewer overview",
        description: "Reads the current viewer overview.",
        document:
          "query ViewerOverview($atTime: DateTime) { viewer { overview(atTime: $atTime) { today } } }",
        scopes: ["dashboard:read"],
        readOnly: true,
        destructive: false,
        openWorld: false,
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
          scopes: ["dashboard:read"],
          readOnly: true,
          destructive: false,
          openWorld: false,
          requiresConfirmation: false,
          operationName: "ViewerOverview",
          operationType: "query",
          rootField: "viewer",
          variables: [{ name: "atTime", type: "DateTime", required: false }],
        },
      ],
    });
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
      openWorld: false,
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
    expect(() =>
      createPersistedGraphqlOperationRegistry([
        { ...base, scopes: ["admin:read"] },
      ]),
    ).toThrow('unsupported scope "admin:read"');
    expect(() =>
      createPersistedGraphqlOperationRegistry([
        {
          ...base,
          document:
            "query Catalog { currentSemester { jwId } semesters { pageInfo { total } } }",
        },
      ]),
    ).toThrow("must select exactly one root field");
    expect(() =>
      createPersistedGraphqlOperationRegistry([
        {
          ...base,
          id: "viewer.combined.v1",
          document:
            "query CombinedViewer { viewer { profile { id } todos { pageInfo { total } } } }",
          scopes: ["me:read"],
        },
      ]),
    ).toThrow("must select exactly one Viewer field");
  });
});
