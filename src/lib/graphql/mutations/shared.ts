import {
  homeworkDescriptionInputSchema,
  homeworkTitleSchema,
} from "@/features/homeworks/lib/homework-schema";
import { setUserSectionSubscriptionByJwId } from "@/features/subscriptions/server/subscriptions";
import { uploadConfig } from "@/features/uploads/lib/upload-config";
import { sanitizeFilename } from "@/features/uploads/lib/upload-utils";
import { UploadError } from "@/features/uploads/server/upload-quota";
import { attributionFromGraphqlPrincipal } from "@/lib/audit/principal-attribution";
import { getAuditRequestMetadata } from "@/lib/audit/write-audit-log";
import { hasAsciiControlCharacters } from "@/lib/text/ascii-control-characters";
import type { GraphqlPrincipal } from "../auth";
import type { GraphqlContext } from "../context";
import { requireGraphqlId } from "../input-boundaries";
import {
  badMutationInput,
  forbiddenMutation,
  mutationNotFound,
  serviceUnavailableMutation,
} from "../mutation-errors";
import { requireGraphqlMutation } from "../mutation-guard";
import {
  rejectDuplicateMutationTargets,
  requireMutationBatchSize,
  requireMutationId,
} from "../mutation-input";

export const batchMutationErrorCodeResolver = {
  NOT_FOUND: "not_found",
  FORBIDDEN: "forbidden",
  LOCKED: "locked",
  DELETED: "deleted",
  SUSPENDED: "suspended",
} as const;

export function graphqlCommentAuditMetadata(
  request: Request,
  principal: Exclude<GraphqlPrincipal, { kind: "anonymous" }>,
) {
  return {
    ...getAuditRequestMetadata(request),
    ...attributionFromGraphqlPrincipal(principal),
    source: "graphql",
  };
}

export function handleTodoFailure(result: {
  error: "forbidden" | "no_changes" | "not_found";
}): never {
  if (result.error === "not_found") mutationNotFound("Todo not found.");
  if (result.error === "forbidden") forbiddenMutation();
  return badMutationInput("No todo changes were provided.");
}

export function handleCommentFailure(result: { error: string }): never {
  if (
    result.error === "not_found" ||
    result.error === "parent_not_found" ||
    result.error === "target_not_found"
  ) {
    mutationNotFound("Comment target not found.");
  }
  if (result.error === "forbidden") forbiddenMutation();
  if (result.error === "locked") forbiddenMutation("Comment is locked.");
  if (result.error === "suspended") {
    forbiddenMutation("Comment writes are suspended.");
  }
  return badMutationInput("Invalid comment mutation.");
}

export function handleDescriptionFailure(result: { error: string }): never {
  if (result.error === "not_found") {
    mutationNotFound("Description target not found.");
  }
  if (result.error === "invalid_target") {
    badMutationInput("Invalid description target.");
  }
  if (result.error === "suspended") {
    forbiddenMutation("Description writes are suspended.");
  }
  return forbiddenMutation();
}

export function handleHomeworkFailure(
  result: { error: string },
  missingTarget: "Homework" | "Section",
): never {
  if (result.error === "not_found") {
    mutationNotFound(`${missingTarget} not found.`);
  }
  if (result.error === "mismatch") {
    badMutationInput("Invalid section.");
  }
  if (result.error === "no_changes") {
    badMutationInput("No homework changes were provided.");
  }
  if (result.error === "deleted") {
    forbiddenMutation("Homework is deleted.");
  }
  if (result.error === "suspended") {
    forbiddenMutation("Homework writes are suspended.");
  }
  return forbiddenMutation();
}

export function handleUploadFailure(result: { error: string }): never {
  if (result.error === "not_found") {
    mutationNotFound("Upload not found.");
  }
  if (result.error === "suspended") {
    forbiddenMutation("Upload writes are suspended.");
  }
  if (result.error === "storage_delete_failed") {
    serviceUnavailableMutation(
      "Upload storage deletion failed; metadata was preserved.",
    );
  }
  return forbiddenMutation();
}

export function handleUploadError(error: unknown): never {
  if (error instanceof UploadError) {
    badMutationInput(error.code);
  }
  throw error;
}

export function normalizeUploadFilename(value: string, maxLength?: number) {
  const filename = value.trim();
  if (
    !filename ||
    (maxLength !== undefined && filename.length > maxLength) ||
    hasAsciiControlCharacters(filename)
  ) {
    badMutationInput(
      maxLength === undefined
        ? "filename must be non-empty and contain no control characters."
        : `filename must contain 1-${maxLength} characters and no control characters.`,
    );
  }
  return sanitizeFilename(filename);
}

export function normalizeUploadSize(value: number) {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > uploadConfig.maxFileSizeBytes
  ) {
    badMutationInput(
      `size must be an integer between 1 and ${uploadConfig.maxFileSizeBytes}.`,
    );
  }
  return value;
}

export function normalizeHomeworkTitle(value: string) {
  const result = homeworkTitleSchema.safeParse(value);
  if (!result.success) {
    badMutationInput("title must contain 1-200 characters.");
  }
  return result.data;
}

export function normalizeHomeworkDescription(value: string | null | undefined) {
  const result = homeworkDescriptionInputSchema.safeParse(value);
  if (!result.success) {
    badMutationInput("description must not exceed 4000 characters.");
  }
  return result.data;
}

export function normalizeBatchIds(
  values: readonly string[],
  label: string,
  max: number,
) {
  requireMutationBatchSize(values, label, max);
  const ids = values.map((value) => requireMutationId(value, label));
  rejectDuplicateMutationTargets(ids, label);
  return ids;
}

export function normalizeSubscriptionBatchCodes(values: readonly string[]) {
  if (values.length > 500) {
    badMutationInput("codes must contain at most 500 items.");
  }
  const codes = values.map((value) => {
    const code = value.trim();
    if (!code || code.length > 64) {
      badMutationInput("codes must contain 1-64 character values.");
    }
    return code;
  });
  rejectDuplicateMutationTargets(
    codes.map((code) => code.toUpperCase()),
    "codes",
  );
  return codes;
}

export async function setSectionSubscription(
  context: GraphqlContext,
  jwId: number,
  subscribed: boolean,
) {
  const principal = await requireGraphqlMutation(
    context,
    "workspace.subscription",
  );
  const result = await setUserSectionSubscriptionByJwId({
    sectionJwId: requireGraphqlId(jwId, "jwId"),
    subscribed,
    userId: principal.userId,
  });
  if (!result) mutationNotFound("Section not found.");
  return result;
}
