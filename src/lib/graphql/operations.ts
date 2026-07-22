import {
  type DocumentNode,
  type FragmentDefinitionNode,
  getOperationAST,
  Kind,
  Lexer,
  parse,
  print,
  type SelectionSetNode,
  Source,
  TokenKind,
  validate,
  visit,
} from "graphql";
import { PUBLIC_REST_SCOPES } from "@/lib/oauth/scope-registry";
import { GRAPHQL_LIMITS } from "./constants";
import {
  analyzeGraphqlOperation,
  countGraphqlTopLevelFields,
} from "./operation-analysis";
import { persistedGraphqlOperationDefinitions } from "./operation-definitions";
import { graphqlOperationValidationSchema } from "./validation-schema";

export { graphqlOperationValidationSchema } from "./validation-schema";

export type PersistedGraphqlOperationDefinition = Readonly<{
  description: string;
  destructive: boolean;
  document: string;
  id: string;
  openWorld: boolean;
  readOnly: boolean;
  requiresConfirmation: boolean;
  scopes: readonly string[];
  title: string;
}>;

export type PersistedGraphqlOperationVariable = Readonly<{
  name: string;
  required: boolean;
  type: string;
}>;

export type RegisteredPersistedGraphqlOperation = Readonly<
  Omit<PersistedGraphqlOperationDefinition, "document"> & {
    document: DocumentNode;
    operationName: string;
    operationType: "mutation" | "query";
    rootField: string;
    variables: readonly PersistedGraphqlOperationVariable[];
  }
>;

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

function countDocumentTokens(source: string) {
  const lexer = new Lexer(new Source(source));
  let count = 0;
  while (lexer.advance().kind !== TokenKind.EOF) count += 1;
  return count;
}

function selectionDepth(
  selectionSet: SelectionSetNode,
  fragments: ReadonlyMap<string, FragmentDefinitionNode>,
  fragmentStack = new Set<string>(),
): number {
  let max = 0;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentName = selection.name?.value;
      if (!fragmentName || fragmentStack.has(fragmentName)) continue;
      const fragment = fragments.get(fragmentName);
      if (!fragment) continue;
      fragmentStack.add(fragmentName);
      max = Math.max(
        max,
        selectionDepth(fragment.selectionSet, fragments, fragmentStack),
      );
      fragmentStack.delete(fragmentName);
      continue;
    }

    max = Math.max(
      max,
      1 +
        (selection.selectionSet
          ? selectionDepth(selection.selectionSet, fragments, fragmentStack)
          : 0),
    );
  }

  return max;
}

function validateDocumentBudgets(
  id: string,
  source: string,
  document: DocumentNode,
) {
  let aliases = 0;
  let directives = 0;
  let introspectionFields = 0;
  visit(document, {
    Directive() {
      directives += 1;
    },
    Field(node) {
      if (node.alias) aliases += 1;
      if (node.name.value.startsWith("__")) introspectionFields += 1;
    },
  });

  const operation = getOperationAST(document);
  requireInvariant(operation, `operation "${id}" is missing`);
  const fragments = new Map(
    document.definitions.flatMap((definition) =>
      definition.kind === Kind.FRAGMENT_DEFINITION
        ? [[definition.name.value, definition] as const]
        : [],
    ),
  );
  const analysis = analyzeGraphqlOperation({
    document,
    operationName: operation.name?.value,
    variables: {},
  });

  requireInvariant(
    countDocumentTokens(source) <= GRAPHQL_LIMITS.tokens,
    `operation "${id}" exceeds the token budget`,
  );
  requireInvariant(
    aliases <= GRAPHQL_LIMITS.aliases,
    `operation "${id}" exceeds the alias budget`,
  );
  requireInvariant(
    directives <= GRAPHQL_LIMITS.directives,
    `operation "${id}" exceeds the directive budget`,
  );
  requireInvariant(
    selectionDepth(operation.selectionSet, fragments) <= GRAPHQL_LIMITS.depth,
    `operation "${id}" exceeds the depth budget`,
  );
  requireInvariant(
    countGraphqlTopLevelFields(document, operation) <=
      GRAPHQL_LIMITS.topLevelFields,
    `operation "${id}" exceeds the top-level field budget`,
  );
  requireInvariant(
    analysis.estimatedCost <= GRAPHQL_LIMITS.cost,
    `operation "${id}" exceeds the cost budget`,
  );
  requireInvariant(
    introspectionFields === 0,
    `operation "${id}" must not use introspection fields`,
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
        requireInvariant(
          PUBLIC_REST_SCOPES.includes(
            scope as (typeof PUBLIC_REST_SCOPES)[number],
          ),
          `operation "${definition.id}" has unsupported scope "${scope}"`,
        );
      }

      const document = parse(definition.document);
      const validationErrors = validate(
        graphqlOperationValidationSchema,
        document,
      );
      requireInvariant(
        validationErrors.length === 0,
        `operation "${definition.id}" does not match the schema: ${
          validationErrors[0]?.message ?? "unknown validation error"
        }`,
      );
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

      const rootFields = operation.selectionSet.selections.filter(
        (selection) => selection.kind === Kind.FIELD,
      );
      requireInvariant(
        rootFields.length === 1 &&
          operation.selectionSet.selections.length === 1,
        `operation "${definition.id}" must select exactly one root field`,
      );
      const rootField = rootFields[0].name.value;

      if (operation.operation === "query" && rootField === "viewer") {
        const viewerFields =
          rootFields[0].selectionSet?.selections.filter(
            (selection) => selection.kind === Kind.FIELD,
          ) ?? [];
        requireInvariant(
          viewerFields.length === 1 &&
            rootFields[0].selectionSet?.selections.length === 1,
          `viewer operation "${definition.id}" must select exactly one Viewer field`,
        );
        requireInvariant(
          definition.scopes.length === 1 &&
            definition.scopes[0].endsWith(":read"),
          `viewer operation "${definition.id}" requires exactly one read scope`,
        );
      } else if (operation.operation === "query") {
        requireInvariant(
          definition.scopes.length === 0,
          `public query "${definition.id}" must not require feature scopes`,
        );
      }

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
        !definition.openWorld || operation.operation === "mutation",
        `operation "${definition.id}" marks a query as open-world`,
      );
      requireInvariant(
        operation.operation !== "mutation" || definition.requiresConfirmation,
        `mutation "${definition.id}" requires confirmation`,
      );
      requireInvariant(
        !definition.destructive || definition.requiresConfirmation,
        `destructive operation "${definition.id}" requires confirmation`,
      );
      requireInvariant(
        operation.operation !== "mutation" ||
          definition.scopes.some((scope) => scope.endsWith(":write")),
        `mutation "${definition.id}" requires a write scope`,
      );

      validateDocumentBudgets(definition.id, definition.document, document);
      const variables = Object.freeze(
        (operation.variableDefinitions ?? []).map((variable) =>
          Object.freeze({
            name: variable.variable.name.value,
            type: print(variable.type),
            required: variable.type.kind === Kind.NON_NULL_TYPE,
          }),
        ),
      );

      return Object.freeze({
        ...definition,
        document,
        scopes: Object.freeze([...definition.scopes]),
        variables,
        operationName,
        operationType: operation.operation,
        rootField,
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
        rootField: operation.rootField,
        variables: operation.variables,
        scopes: Object.freeze([...operation.scopes].sort()),
        readOnly: operation.readOnly,
        destructive: operation.destructive,
        openWorld: operation.openWorld,
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
  createPersistedGraphqlOperationRegistry(persistedGraphqlOperationDefinitions);

export const graphqlPersistedOperationById = new Map(
  graphqlPersistedOperationRegistry.map((operation) => [
    operation.id,
    operation,
  ]),
);

export const publicGraphqlOperationsManifest =
  createPublicGraphqlOperationsManifest(graphqlPersistedOperationRegistry);
