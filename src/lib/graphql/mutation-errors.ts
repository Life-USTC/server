import { GraphQLError } from "graphql";

type GraphqlMutationErrorCode =
  | "BAD_USER_INPUT"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE";

export class GraphqlMutationError extends GraphQLError {
  constructor(
    message: string,
    code: GraphqlMutationErrorCode,
    status: 400 | 403 | 404 | 429 | 503,
  ) {
    super(message, {
      extensions: {
        code,
        http: { status },
      },
    });
  }
}

export function badMutationInput(message: string): never {
  throw new GraphqlMutationError(message, "BAD_USER_INPUT", 400);
}

export function forbiddenMutation(message = "Forbidden"): never {
  throw new GraphqlMutationError(message, "FORBIDDEN", 403);
}

export function mutationNotFound(message: string): never {
  throw new GraphqlMutationError(message, "NOT_FOUND", 404);
}

export function serviceUnavailableMutation(message: string): never {
  throw new GraphqlMutationError(message, "SERVICE_UNAVAILABLE", 503);
}
