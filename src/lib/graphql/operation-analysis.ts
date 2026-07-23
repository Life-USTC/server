import {
  type DocumentNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type GraphQLCompositeType,
  getNamedType,
  getOperationAST,
  isCompositeType,
  isInterfaceType,
  isObjectType,
  Kind,
  type OperationDefinitionNode,
  type SelectionSetNode,
  type ValueNode,
} from "graphql";
import { GRAPHQL_LIMITS } from "./constants";
import { graphqlOperationValidationSchema } from "./validation-schema";

export type GraphqlOperationType =
  | "mutation"
  | "query"
  | "subscription"
  | "unknown";

export type GraphqlOperationAnalysis = {
  estimatedCost: number;
  operationName: string;
  operationType: GraphqlOperationType;
  topLevelFieldCount: number;
};

const UNKNOWN_ANALYSIS: GraphqlOperationAnalysis = {
  estimatedCost: 0,
  operationName: "unknown",
  operationType: "unknown",
  topLevelFieldCount: 0,
};

export const PAGINATED_FIELD_COORDINATES = new Set([
  "Catalog.busRoutes",
  "Catalog.busTimetable",
  "Catalog.courses",
  "Catalog.sections",
  "Catalog.semesters",
  "Catalog.teachers",
  "Exam.examRooms",
  "Schedule.teachers",
  "Workspace.exams",
  "Workspace.homeworks",
  "Workspace.schedules",
  "Workspace.subscribedSections",
  "Workspace.todos",
]);

function fragmentDefinitions(document: DocumentNode) {
  return new Map(
    document.definitions.flatMap((definition) =>
      definition.kind === Kind.FRAGMENT_DEFINITION
        ? [[definition.name.value, definition] as const]
        : [],
    ),
  );
}

function countTopLevelFields(
  selectionSet: SelectionSetNode,
  fragments: ReadonlyMap<string, FragmentDefinitionNode>,
  fragmentStack: Set<string>,
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
        fragments,
        fragmentStack,
      );
      continue;
    }

    const fragmentName = selection.name.value;
    if (fragmentStack.has(fragmentName)) continue;
    const fragment = fragments.get(fragmentName);
    if (!fragment) continue;

    fragmentStack.add(fragmentName);
    count += countTopLevelFields(
      fragment.selectionSet,
      fragments,
      fragmentStack,
    );
    fragmentStack.delete(fragmentName);
  }

  return count;
}

export function countGraphqlTopLevelFields(
  document: DocumentNode,
  operation: OperationDefinitionNode,
) {
  return countTopLevelFields(
    operation.selectionSet,
    fragmentDefinitions(document),
    new Set(),
  );
}

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
  parentType: GraphQLCompositeType,
) {
  if (!PAGINATED_FIELD_COORDINATES.has(`${parentType.name}.${node.name.value}`))
    return 1;

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
  parentType,
}: {
  selectionSet: SelectionSetNode;
  fragments: ReadonlyMap<string, FragmentDefinitionNode>;
  variables: Record<string, unknown>;
  fragmentStack: Set<string>;
  parentType: GraphQLCompositeType;
}): number {
  let cost = 0;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      let fieldCost = 1;
      const field =
        isObjectType(parentType) || isInterfaceType(parentType)
          ? parentType.getFields()[selection.name.value]
          : undefined;
      const childType = field ? getNamedType(field.type) : undefined;
      if (selection.selectionSet && childType && isCompositeType(childType)) {
        fieldCost =
          2 +
          selectionCost({
            selectionSet: selection.selectionSet,
            fragments,
            variables,
            fragmentStack,
            parentType: childType,
          });
      }
      cost +=
        fieldCost * paginatedFieldMultiplier(selection, variables, parentType);
      continue;
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      const fragmentType = selection.typeCondition
        ? graphqlOperationValidationSchema.getType(
            selection.typeCondition.name.value,
          )
        : parentType;
      cost += selectionCost({
        selectionSet: selection.selectionSet,
        fragments,
        variables,
        fragmentStack,
        parentType:
          fragmentType && isCompositeType(fragmentType)
            ? fragmentType
            : parentType,
      });
      continue;
    }

    const fragmentName = selection.name.value;
    const fragment = fragments.get(fragmentName);
    if (!fragment) continue;
    if (fragmentStack.has(fragmentName)) return GRAPHQL_LIMITS.cost + 1;

    fragmentStack.add(fragmentName);
    const fragmentType = graphqlOperationValidationSchema.getType(
      fragment.typeCondition.name.value,
    );
    cost += selectionCost({
      selectionSet: fragment.selectionSet,
      fragments,
      variables,
      fragmentStack,
      parentType:
        fragmentType && isCompositeType(fragmentType)
          ? fragmentType
          : parentType,
    });
    fragmentStack.delete(fragmentName);
  }

  return cost;
}

export function estimateGraphqlOperationCost(
  document: DocumentNode,
  operation: OperationDefinitionNode,
  variables: Record<string, unknown>,
) {
  const parentType =
    operation.operation === "mutation"
      ? graphqlOperationValidationSchema.getMutationType()
      : operation.operation === "query"
        ? graphqlOperationValidationSchema.getQueryType()
        : graphqlOperationValidationSchema.getSubscriptionType();
  if (!parentType) return GRAPHQL_LIMITS.cost + 1;
  return selectionCost({
    selectionSet: operation.selectionSet,
    fragments: fragmentDefinitions(document),
    variables,
    fragmentStack: new Set(),
    parentType,
  });
}

function sanitizedOperationName(operation: OperationDefinitionNode) {
  const name = operation.name?.value;
  if (!name) return "anonymous";
  return /^[_A-Za-z][_0-9A-Za-z]*$/.test(name) ? name.slice(0, 80) : "unknown";
}

export function analyzeGraphqlOperation({
  document,
  operationName,
  variables,
}: {
  document: DocumentNode;
  operationName?: string | null;
  variables: Record<string, unknown>;
}): GraphqlOperationAnalysis {
  const operation = getOperationAST(document, operationName);
  if (!operation) return { ...UNKNOWN_ANALYSIS };

  return {
    estimatedCost: estimateGraphqlOperationCost(document, operation, variables),
    operationName: sanitizedOperationName(operation),
    operationType: operation.operation,
    topLevelFieldCount: countGraphqlTopLevelFields(document, operation),
  };
}
