import { GraphQLError } from "graphql";
import { GRAPHQL_LIMITS } from "./constants";

function badUserInput(message: string): never {
  throw new GraphQLError(message, {
    extensions: { code: "BAD_USER_INPUT" },
  });
}

export function requireGraphqlId(value: number, name: string) {
  if (!Number.isInteger(value) || value < 1) {
    badUserInput(`${name} must be a positive integer.`);
  }
  return value;
}

export function validateOptionalGraphqlId(
  value: number | null | undefined,
  name: string,
) {
  return value == null ? undefined : requireGraphqlId(value, name);
}

export function validateGraphqlIdList(
  values: number[] | null | undefined,
  name: string,
) {
  if (values == null) return undefined;
  if (values.length > GRAPHQL_LIMITS.idList) {
    badUserInput(
      `${name} must contain at most ${GRAPHQL_LIMITS.idList} items.`,
    );
  }
  if (values.some((value) => !Number.isInteger(value) || value < 1)) {
    badUserInput(`${name} must contain positive integers.`);
  }
  return values;
}

function validateOptionalText(
  value: string | null | undefined,
  name: string,
  maxLength: number,
) {
  if (value == null) return undefined;
  if (value.length > maxLength) {
    badUserInput(`${name} must not exceed ${maxLength} characters.`);
  }
  return value;
}

export function validateGraphqlSearch(value: string | null | undefined) {
  return validateOptionalText(value, "search", GRAPHQL_LIMITS.searchChars);
}

export function validateGraphqlTeacherCode(value: string | null | undefined) {
  return validateOptionalText(
    value,
    "teacherCode",
    GRAPHQL_LIMITS.teacherCodeChars,
  );
}

export function validateGraphqlVersionKey(value: string | null | undefined) {
  const versionKey = validateOptionalText(
    value,
    "versionKey",
    GRAPHQL_LIMITS.versionKeyChars,
  );
  if (
    versionKey !== undefined &&
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(versionKey)
  ) {
    badUserInput("versionKey has an invalid format.");
  }
  return versionKey;
}
