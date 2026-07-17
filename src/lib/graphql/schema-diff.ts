import {
  BreakingChangeType,
  buildSchema,
  findBreakingChanges,
  isInterfaceType,
  isNonNullType,
  isObjectType,
} from "graphql";

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
