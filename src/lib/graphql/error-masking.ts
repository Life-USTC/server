import { GraphQLError, type GraphQLFormattedError } from "graphql";
import {
  type MaskError,
  maskError as maskUnexpectedGraphqlError,
} from "graphql-yoga";

const SAFE_GRAPHQL_ERROR_CODES = new Set([
  "BAD_USER_INPUT",
  "FORBIDDEN",
  "NOT_FOUND",
  "RATE_LIMITED",
  "SERVICE_UNAVAILABLE",
  "UNAUTHENTICATED",
]);

function hasTrustedGraphqlErrorChain(value: unknown): value is GraphQLError {
  const seen = new Set<unknown>();
  let current: unknown = value;

  try {
    while (current != null) {
      if (seen.has(current)) return false;
      seen.add(current);

      if (current instanceof GraphQLError) {
        if (current.originalError == null) return true;
        current = current.originalError;
        continue;
      }

      if (!(current instanceof Error) || !("originalError" in current)) {
        return false;
      }
      const originalError = current.originalError;
      if (
        !(originalError instanceof Error) ||
        !("extensions" in current) ||
        !("extensions" in originalError) ||
        current.message !== originalError.message ||
        current.extensions !== originalError.extensions
      ) {
        return false;
      }
      current = originalError;
    }
  } catch {
    return false;
  }

  return false;
}

function isSafeGraphqlError(error: unknown): error is GraphQLError {
  return (
    hasTrustedGraphqlErrorChain(error) &&
    typeof error.extensions.code === "string" &&
    SAFE_GRAPHQL_ERROR_CODES.has(error.extensions.code)
  );
}

export const maskGraphqlError: MaskError = (error, message, isDev) => {
  if (isSafeGraphqlError(error)) return error;
  return maskUnexpectedGraphqlError(error, message, isDev);
};

export function formatMaskedGraphqlError(
  error: GraphQLError,
): GraphQLFormattedError {
  const candidate =
    error.originalError instanceof GraphQLError ? error.originalError : error;
  const safe = isSafeGraphqlError(candidate);
  return {
    message: safe ? candidate.message : "Unexpected error.",
    extensions: safe ? candidate.extensions : { code: "INTERNAL_SERVER_ERROR" },
    ...(error.locations ? { locations: error.locations } : {}),
    ...(error.path ? { path: error.path } : {}),
  };
}
