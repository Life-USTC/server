import { EnvelopArmor } from "@escape.tech/graphql-armor";
import { useDisableIntrospection as disableIntrospectionPlugin } from "@graphql-yoga/plugin-disable-introspection";
import {
  type FieldNode,
  type FragmentDefinitionNode,
  GraphQLError,
  getOperationAST,
  Kind,
  OperationTypeNode,
  type SelectionSetNode,
  type ValidationContext,
  type ValidationRule,
  type ValueNode,
} from "graphql";
import {
  useExecutionCancellation as executionCancellationPlugin,
  type Plugin,
} from "graphql-yoga";
import { GRAPHQL_LIMITS } from "./constants";

function countTopLevelFields(
  selectionSet: SelectionSetNode,
  context: ValidationContext,
  fragmentStack = new Set<string>(),
): number {
  let count = 0;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      count += 1;
      continue;
    }
    if (selection.kind === Kind.INLINE_FRAGMENT) {
      count += countTopLevelFields(
        selection.selectionSet,
        context,
        fragmentStack,
      );
      continue;
    }

    const fragmentName = selection.name.value;
    if (fragmentStack.has(fragmentName)) continue;
    const fragment = context.getFragment(fragmentName);
    if (!fragment) continue;

    fragmentStack.add(fragmentName);
    count += countTopLevelFields(fragment.selectionSet, context, fragmentStack);
    fragmentStack.delete(fragmentName);
  }

  return count;
}

export const maxTopLevelFieldsRule: ValidationRule = (context) => ({
  OperationDefinition(node) {
    if (node.operation !== OperationTypeNode.QUERY) return;

    if (
      countTopLevelFields(node.selectionSet, context) >
      GRAPHQL_LIMITS.topLevelFields
    ) {
      context.reportError(
        new GraphQLError("Query has too many top-level fields.", {
          nodes: node,
          extensions: { code: "GRAPHQL_VALIDATION_FAILED" },
        }),
      );
    }
  },
});

const topLevelFieldPlugin: Plugin = {
  onValidate({ addValidationRule }) {
    addValidationRule(maxTopLevelFieldsRule);
  },
};

const paginatedFields = new Set([
  "busRoutes",
  "busTimetable",
  "courses",
  "exams",
  "homeworks",
  "sections",
  "semesters",
  "schedules",
  "subscribedSections",
  "teachers",
  "todos",
]);

function variableInteger(value: ValueNode, variables: Record<string, unknown>) {
  if (value.kind === Kind.INT) return Number(value.value);
  if (value.kind !== Kind.VARIABLE) return undefined;
  const variable = variables[value.name.value];
  return typeof variable === "number" && Number.isInteger(variable)
    ? variable
    : undefined;
}

function paginatedFieldMultiplier(
  node: FieldNode,
  variables: Record<string, unknown>,
) {
  if (!paginatedFields.has(node.name.value)) return 1;

  const pageArgument = node.arguments?.find(
    (argument) => argument.name.value === "page",
  );
  if (!pageArgument) return GRAPHQL_LIMITS.defaultPageSize;

  let pageSize: number | undefined;
  if (pageArgument.value.kind === Kind.VARIABLE) {
    const page = variables[pageArgument.value.name.value];
    const value =
      typeof page === "object" && page !== null && "pageSize" in page
        ? page.pageSize
        : undefined;
    pageSize =
      typeof value === "number" && Number.isInteger(value) ? value : undefined;
  } else if (pageArgument.value.kind === Kind.OBJECT) {
    const pageSizeField = pageArgument.value.fields.find(
      (field) => field.name.value === "pageSize",
    );
    if (pageSizeField) {
      pageSize = variableInteger(pageSizeField.value, variables);
    }
  }

  return pageSize == null
    ? GRAPHQL_LIMITS.defaultPageSize
    : Math.max(pageSize, 1);
}

function selectionCost({
  selectionSet,
  fragments,
  variables,
  fragmentStack,
}: {
  selectionSet: SelectionSetNode;
  fragments: ReadonlyMap<string, FragmentDefinitionNode>;
  variables: Record<string, unknown>;
  fragmentStack: Set<string>;
}): number {
  let cost = 0;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      let fieldCost = 1;
      if (selection.selectionSet) {
        fieldCost =
          2 +
          selectionCost({
            selectionSet: selection.selectionSet,
            fragments,
            variables,
            fragmentStack,
          });
      }
      cost += fieldCost * paginatedFieldMultiplier(selection, variables);
      continue;
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      cost += selectionCost({
        selectionSet: selection.selectionSet,
        fragments,
        variables,
        fragmentStack,
      });
      continue;
    }

    const fragmentName = selection.name.value;
    const fragment = fragments.get(fragmentName);
    if (!fragment) continue;
    if (fragmentStack.has(fragmentName)) return GRAPHQL_LIMITS.cost + 1;

    fragmentStack.add(fragmentName);
    cost += selectionCost({
      selectionSet: fragment.selectionSet,
      fragments,
      variables,
      fragmentStack,
    });
    fragmentStack.delete(fragmentName);
  }

  return cost;
}

function operationCost(
  document: Parameters<typeof getOperationAST>[0],
  operationName: string | null | undefined,
  variables: Record<string, unknown>,
) {
  const operation = getOperationAST(document, operationName);
  if (!operation) return 0;

  const fragments = new Map(
    document.definitions.flatMap((definition) =>
      definition.kind === Kind.FRAGMENT_DEFINITION
        ? [[definition.name.value, definition] as const]
        : [],
    ),
  );
  return selectionCost({
    selectionSet: operation.selectionSet,
    fragments,
    variables,
    fragmentStack: new Set(),
  });
}

const operationCostPlugin: Plugin = {
  onExecute({ args, setResultAndStopExecution }) {
    const cost = operationCost(
      args.document,
      args.operationName,
      args.variableValues ?? {},
    );
    if (cost <= GRAPHQL_LIMITS.cost) return;

    setResultAndStopExecution({
      errors: [
        new GraphQLError("Query cost limit exceeded.", {
          extensions: { code: "GRAPHQL_VALIDATION_FAILED" },
        }),
      ],
    });
  },
};

export function createGraphqlSecurityPlugins(production: boolean) {
  const armor = new EnvelopArmor({
    blockFieldSuggestion: { enabled: true },
    costLimit: {
      errorMessage: "Query cost limit exceeded.",
      maxCost: GRAPHQL_LIMITS.cost,
      exposeLimits: false,
    },
    maxAliases: {
      n: GRAPHQL_LIMITS.aliases,
      exposeLimits: false,
    },
    maxDepth: {
      errorMessage: "Query depth limit exceeded.",
      n: GRAPHQL_LIMITS.depth,
      exposeLimits: false,
      flattenFragments: true,
    },
    maxDirectives: {
      n: GRAPHQL_LIMITS.directives,
      exposeLimits: false,
    },
    maxTokens: {
      n: GRAPHQL_LIMITS.tokens,
      exposeLimits: false,
    },
  });

  return [
    ...armor.protect().plugins,
    topLevelFieldPlugin,
    operationCostPlugin,
    ...(production ? [disableIntrospectionPlugin()] : []),
    executionCancellationPlugin(),
  ];
}
