import { getOperationAST, Kind, parse } from "graphql";

export type PersistedGraphqlOperationDefinition = Readonly<{
  description: string;
  destructive: boolean;
  document: string;
  id: string;
  readOnly: boolean;
  requiresConfirmation: boolean;
  scopes: readonly string[];
  title: string;
}>;

export type RegisteredPersistedGraphqlOperation =
  PersistedGraphqlOperationDefinition &
    Readonly<{
      operationName: string;
      operationType: "mutation" | "query";
    }>;

export type PublicPersistedGraphqlOperation = Readonly<
  Omit<RegisteredPersistedGraphqlOperation, "document">
>;

export type PublicGraphqlOperationsManifest = Readonly<{
  operations: readonly PublicPersistedGraphqlOperation[];
  schemaVersion: 1;
}>;

function requireInvariant(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition)
    throw new Error(`Invalid persisted GraphQL operation: ${message}`);
}

function requireTrimmedValue(value: string, field: string) {
  requireInvariant(
    value.length > 0 && value === value.trim(),
    `${field} must be a non-empty trimmed string`,
  );
}

export function createPersistedGraphqlOperationRegistry(
  definitions: readonly PersistedGraphqlOperationDefinition[],
): readonly RegisteredPersistedGraphqlOperation[] {
  const ids = new Set<string>();
  const operationNames = new Set<string>();

  return Object.freeze(
    definitions.map((definition) => {
      requireTrimmedValue(definition.id, "id");
      requireInvariant(
        /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*$/.test(definition.id),
        `id "${definition.id}" is not stable`,
      );
      requireInvariant(
        !ids.has(definition.id),
        `duplicate id "${definition.id}"`,
      );
      ids.add(definition.id);

      requireTrimmedValue(definition.title, "title");
      requireTrimmedValue(definition.description, "description");
      requireInvariant(
        new Set(definition.scopes).size === definition.scopes.length,
        `operation "${definition.id}" has duplicate scopes`,
      );
      for (const scope of definition.scopes) {
        requireTrimmedValue(scope, "scope");
      }

      const document = parse(definition.document);
      const operations = document.definitions.filter(
        (node) => node.kind === Kind.OPERATION_DEFINITION,
      );
      requireInvariant(
        operations.length === 1,
        `operation "${definition.id}" must contain exactly one operation`,
      );
      const operation = getOperationAST(document);
      requireInvariant(
        operation?.operation === "query" || operation?.operation === "mutation",
        `operation "${definition.id}" must be a query or mutation`,
      );
      const operationName = operation.name?.value;
      requireInvariant(
        operationName,
        `operation "${definition.id}" must be named`,
      );
      requireInvariant(
        !operationNames.has(operationName),
        `duplicate operation name "${operationName}"`,
      );
      operationNames.add(operationName);

      requireInvariant(
        operation.operation === "query"
          ? definition.readOnly
          : !definition.readOnly,
        `operation "${definition.id}" has inconsistent readOnly metadata`,
      );
      requireInvariant(
        !definition.destructive || operation.operation === "mutation",
        `operation "${definition.id}" marks a query as destructive`,
      );
      requireInvariant(
        !definition.destructive || definition.requiresConfirmation,
        `destructive operation "${definition.id}" requires confirmation`,
      );

      return Object.freeze({
        ...definition,
        scopes: Object.freeze([...definition.scopes]),
        operationName,
        operationType: operation.operation,
      });
    }),
  );
}

export function createPublicGraphqlOperationsManifest(
  registry: readonly RegisteredPersistedGraphqlOperation[],
): PublicGraphqlOperationsManifest {
  const operations = registry
    .map((operation) =>
      Object.freeze({
        id: operation.id,
        title: operation.title,
        description: operation.description,
        operationName: operation.operationName,
        operationType: operation.operationType,
        scopes: Object.freeze([...operation.scopes].sort()),
        readOnly: operation.readOnly,
        destructive: operation.destructive,
        requiresConfirmation: operation.requiresConfirmation,
      }),
    )
    .sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    );

  return Object.freeze({
    schemaVersion: 1,
    operations: Object.freeze(operations),
  });
}

export const graphqlPersistedOperationRegistry =
  createPersistedGraphqlOperationRegistry([]);

export const publicGraphqlOperationsManifest =
  createPublicGraphqlOperationsManifest(graphqlPersistedOperationRegistry);
