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
    expect(graphqlPersistedOperationRegistry).toHaveLength(45);
    expect(
      graphqlPersistedOperationRegistry.map((operation) => operation.id),
    ).toEqual(
      expect.arrayContaining([
        "workspace.todo.completions.set.v1",
        "workspace.todos.delete.v1",
        "workspace.homework.completions.set.v1",
        "workspace.subscription.import.v1",
        "workspace.link_pin.batch_set.v1",
        "community.comments.delete.v1",
        "workspace.upload.session.create.v1",
        "workspace.upload.complete.v1",
        "workspace.upload.rename.v1",
        "workspace.upload.delete.v1",
      ]),
    );
    const registeredAuthenticatedScopeFields = graphqlPersistedOperationRegistry
      .filter((operation) =>
        ["account", "workspace"].includes(operation.rootField),
      )
      .map((operation) => {
        const operationAst = getOperationAST(
          operation.document,
          operation.operationName,
        );
        const rootSelection = operationAst?.selectionSet.selections[0];
        const scopeSelection =
          rootSelection?.kind === Kind.FIELD
            ? rootSelection.selectionSet?.selections[0]
            : undefined;
        if (scopeSelection?.kind !== Kind.FIELD) {
          throw new Error(`Invalid scoped operation ${operation.id}`);
        }
        return `${operation.rootField}.${scopeSelection.name.value}`;
      })
      .sort();
    expect(registeredAuthenticatedScopeFields).toEqual([
      "account.profile",
      "workspace.exams",
      "workspace.homeworks",
      "workspace.overview",
      "workspace.schedules",
      "workspace.subscribedSections",
      "workspace.todos",
    ]);
  });

  it("publishes frozen safety metadata without operation documents", () => {
    expect(publicGraphqlOperationsManifest.schemaVersion).toBe(1);
    expect(publicGraphqlOperationsManifest.operations).toHaveLength(45);
    expect(Object.isFrozen(publicGraphqlOperationsManifest)).toBe(true);
    expect(Object.isFrozen(publicGraphqlOperationsManifest.operations)).toBe(
      true,
    );

    const todoCreate = publicGraphqlOperationsManifest.operations.find(
      (operation) => operation.id === "workspace.todo.create.v1",
    );
    expect(todoCreate).toEqual({
      id: "workspace.todo.create.v1",
      title: "Create todo",
      description: "Creates a todo owned by the authenticated workspace.",
      operationName: "TodoCreate",
      operationType: "mutation",
      rootField: "todoCreate",
      variables: [{ name: "input", type: "CreateTodoInput!", required: true }],
      scopes: ["workspace.todo:write"],
      readOnly: false,
      destructive: false,
      openWorld: false,
      requiresConfirmation: true,
    });
    expect(todoCreate).not.toHaveProperty("document");

    const todoUpdate = publicGraphqlOperationsManifest.operations.find(
      (operation) => operation.id === "workspace.todo.update.v1",
    );
    expect(todoUpdate).toMatchObject({
      readOnly: false,
      destructive: true,
      requiresConfirmation: true,
    });

    expect(
      Object.fromEntries(
        publicGraphqlOperationsManifest.operations
          .filter((operation) =>
            [
              "workspace.link_pin.batch_set.v1",
              "community.comments.delete.v1",
              "workspace.upload.session.create.v1",
              "workspace.upload.complete.v1",
              "workspace.upload.rename.v1",
              "workspace.upload.delete.v1",
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
      "workspace.link_pin.batch_set.v1": {
        destructive: true,
        openWorld: false,
        requiresConfirmation: true,
        scopes: ["workspace.link-pin:write"],
        variables: ["items"],
      },
      "community.comments.delete.v1": {
        destructive: true,
        openWorld: true,
        requiresConfirmation: true,
        scopes: ["community.comment:write"],
        variables: ["ids"],
      },
      "workspace.upload.session.create.v1": {
        destructive: true,
        openWorld: true,
        requiresConfirmation: true,
        scopes: ["workspace.upload:write"],
        variables: ["input"],
      },
      "workspace.upload.complete.v1": {
        destructive: true,
        openWorld: true,
        requiresConfirmation: true,
        scopes: ["workspace.upload:write"],
        variables: ["input"],
      },
      "workspace.upload.rename.v1": {
        destructive: true,
        openWorld: false,
        requiresConfirmation: true,
        scopes: ["workspace.upload:write"],
        variables: ["id", "filename"],
      },
      "workspace.upload.delete.v1": {
        destructive: true,
        openWorld: true,
        requiresConfirmation: true,
        scopes: ["workspace.upload:write"],
        variables: ["id"],
      },
    });
  });

  it("keeps the product contracts pointed at the registered runner", () => {
    expect(
      graphqlContract.capabilities["registered-operation-runner"].mcp.tools,
    ).toEqual([expect.objectContaining({ name: "graphql_operation_run" })]);
    expect(
      mcpContract.capabilities["tool-groups"].mcp.groups.flatMap(
        (group) => group.tools,
      ),
    ).toContain("graphql_operation_run");
  });

  it("derives variable and root-field metadata for custom definitions", () => {
    const registry = createPersistedGraphqlOperationRegistry([
      {
        id: "workspace_overview.v1",
        title: "Workspace overview",
        description: "Reads the current workspace overview.",
        document:
          "query WorkspaceOverview($atTime: DateTime) { workspace { overview(atTime: $atTime) { today } } }",
        scopes: ["workspace.overview:read"],
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
          id: "workspace_overview.v1",
          title: "Workspace overview",
          description: "Reads the current workspace overview.",
          scopes: ["workspace.overview:read"],
          readOnly: true,
          destructive: false,
          openWorld: false,
          requiresConfirmation: false,
          operationName: "WorkspaceOverview",
          operationType: "query",
          rootField: "workspace",
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
      document: "query Catalog { catalog { currentSemester { jwId } } }",
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
            'query Catalog { catalog { currentSemester { jwId } } community { user(identifier: "x") { id } } }',
        },
      ]),
    ).toThrow("must select exactly one root field");
    expect(() =>
      createPersistedGraphqlOperationRegistry([
        {
          ...base,
          id: "workspace.combined.v1",
          document:
            "query CombinedWorkspace { workspace { overview { today } todos { pageInfo { total } } } }",
          scopes: ["workspace.overview:read"],
        },
      ]),
    ).toThrow("must select exactly one field");
  });
});
