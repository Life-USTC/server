import {
  BreakingChangeType,
  buildSchema,
  DangerousChangeType,
  findBreakingChanges,
  findDangerousChanges,
  isInputObjectType,
  isInterfaceType,
  isNonNullType,
  isObjectType,
  print,
} from "graphql";

const allowedDangerousChangeTypes = new Set<DangerousChangeType>([
  DangerousChangeType.OPTIONAL_ARG_ADDED,
  DangerousChangeType.OPTIONAL_INPUT_FIELD_ADDED,
]);

export type GraphqlDangerousChange = {
  type: DangerousChangeType | "INPUT_FIELD_DEFAULT_VALUE_CHANGE";
  description: string;
};

export function findGraphqlBreakingChanges(
  previousSdl: string,
  nextSdl: string,
) {
  const previousSchema = buildSchema(previousSdl);
  const nextSchema = buildSchema(nextSdl);
  const changes = findBreakingChanges(previousSchema, nextSchema);

  for (const previousType of Object.values(previousSchema.getTypeMap())) {
    if (!isObjectType(previousType) && !isInterfaceType(previousType)) continue;
    const nextType = nextSchema.getType(previousType.name);
    if (!nextType || (!isObjectType(nextType) && !isInterfaceType(nextType))) {
      continue;
    }

    for (const [fieldName, previousField] of Object.entries(
      previousType.getFields(),
    )) {
      const nextField = nextType.getFields()[fieldName];
      if (
        nextField &&
        !isNonNullType(previousField.type) &&
        isNonNullType(nextField.type)
      ) {
        changes.push({
          type: BreakingChangeType.FIELD_CHANGED_KIND,
          description: `${previousType.name}.${fieldName} changed from nullable to non-null.`,
        });
      }
    }
  }

  return changes;
}

export function classifyGraphqlDangerousChanges(
  previousSdl: string,
  nextSdl: string,
) {
  const previousSchema = buildSchema(previousSdl);
  const nextSchema = buildSchema(nextSdl);
  const detected: GraphqlDangerousChange[] = findDangerousChanges(
    previousSchema,
    nextSchema,
  );

  for (const previousType of Object.values(previousSchema.getTypeMap())) {
    if (!isInputObjectType(previousType)) continue;
    const nextType = nextSchema.getType(previousType.name);
    if (!nextType || !isInputObjectType(nextType)) continue;

    for (const [fieldName, previousField] of Object.entries(
      previousType.getFields(),
    )) {
      const nextField = nextType.getFields()[fieldName];
      if (!nextField) continue;
      const previousDefault = previousField.astNode?.defaultValue;
      const nextDefault = nextField.astNode?.defaultValue;
      const previousPrinted = previousDefault
        ? print(previousDefault)
        : undefined;
      const nextPrinted = nextDefault ? print(nextDefault) : undefined;
      if (previousPrinted === nextPrinted) continue;
      detected.push({
        type: "INPUT_FIELD_DEFAULT_VALUE_CHANGE",
        description: `${previousType.name}.${fieldName} default value changed from ${previousPrinted ?? "undefined"} to ${nextPrinted ?? "undefined"}.`,
      });
    }
  }

  return {
    allowed: detected.filter(
      (change) =>
        change.type !== "INPUT_FIELD_DEFAULT_VALUE_CHANGE" &&
        allowedDangerousChangeTypes.has(change.type),
    ),
    blocked: detected.filter(
      (change) =>
        change.type === "INPUT_FIELD_DEFAULT_VALUE_CHANGE" ||
        !allowedDangerousChangeTypes.has(change.type),
    ),
  };
}
