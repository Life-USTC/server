import {
  setHomeworkCompletion,
  setHomeworkCompletions,
} from "@/features/homeworks/server/homework-completion";
import { createHomeworkForSection } from "@/features/homeworks/server/homework-create";
import { homeworkDateError } from "@/features/homeworks/server/homework-dates";
import {
  deleteHomework,
  updateHomework,
} from "@/features/homeworks/server/homework-mutations";
import { requireHomeworkItemById } from "@/features/homeworks/server/homework-read-model";
import { prepareHomeworkUpdate } from "@/features/homeworks/server/prepare-homework-update";
import { attributionFromGraphqlPrincipal } from "@/lib/audit/principal-attribution";
import { getAuditRequestMetadata } from "@/lib/audit/write-audit-log";
import type { GraphqlContext } from "../context";
import { requireGraphqlId } from "../input-boundaries";
import { badMutationInput, mutationNotFound } from "../mutation-errors";
import { requireGraphqlMutation } from "../mutation-guard";
import {
  dateTimeInput,
  rejectExplicitNullFields,
  requireMutationId,
} from "../mutation-input";
import {
  handleHomeworkFailure,
  normalizeBatchIds,
  normalizeHomeworkDescription,
  normalizeHomeworkTitle,
} from "./shared";

type HomeworkCompletionBatchItemInput = {
  completed: boolean;
  homeworkId: string;
};

type CreateHomeworkInput = {
  description?: string | null;
  isMajor: boolean;
  publishedAt?: string | null;
  requiresTeam: boolean;
  sectionJwId: number;
  submissionDueAt?: string | null;
  submissionStartAt?: string | null;
  title: string;
};

type UpdateHomeworkInput = {
  description?: string | null;
  isMajor?: boolean | null;
  publishedAt?: string | null;
  requiresTeam?: boolean | null;
  submissionDueAt?: string | null;
  submissionStartAt?: string | null;
  title?: string | null;
};

export const homeworkMutationResolvers = {
  async homeworkCreate(
    _parent: unknown,
    args: { input: CreateHomeworkInput },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "community.section-homework",
    );
    const input = args.input;
    const publishedAt = dateTimeInput(input.publishedAt) ?? null;
    const submissionStartAt = dateTimeInput(input.submissionStartAt) ?? null;
    const submissionDueAt = dateTimeInput(input.submissionDueAt) ?? null;
    const dateError = homeworkDateError({
      publishedAt,
      submissionDueAt,
      submissionStartAt,
    });
    if (dateError) badMutationInput(dateError);

    const result = await createHomeworkForSection(
      principal.userId,
      {
        description: normalizeHomeworkDescription(input.description),
        isMajor: input.isMajor,
        publishedAt,
        requiresTeam: input.requiresTeam,
        sectionJwId: requireGraphqlId(input.sectionJwId, "sectionJwId"),
        submissionDueAt,
        submissionStartAt,
        title: normalizeHomeworkTitle(input.title),
      },
      {
        ...attributionFromGraphqlPrincipal(principal),
        requestId: getAuditRequestMetadata(context.request).requestId,
      },
    );
    if (!result.ok) handleHomeworkFailure(result, "Section");

    const id = result.homework.id;
    const homework = await requireHomeworkItemById({
      homeworkId: id,
      locale: context.locale,
      userId: principal.userId,
    });
    return { id, homework };
  },
  async homeworkUpdate(
    _parent: unknown,
    args: { id: string; input: UpdateHomeworkInput },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "community.section-homework",
    );
    const id = requireMutationId(args.id, "id");
    const input = args.input;
    rejectExplicitNullFields(input, ["title", "isMajor", "requiresTeam"]);

    const hasDescription = Object.hasOwn(input, "description");
    const hasPublishedAt = Object.hasOwn(input, "publishedAt");
    const hasSubmissionStartAt = Object.hasOwn(input, "submissionStartAt");
    const hasSubmissionDueAt = Object.hasOwn(input, "submissionDueAt");
    const publishedAt = hasPublishedAt
      ? dateTimeInput(input.publishedAt)
      : undefined;
    const submissionStartAt = hasSubmissionStartAt
      ? dateTimeInput(input.submissionStartAt)
      : undefined;
    const submissionDueAt = hasSubmissionDueAt
      ? dateTimeInput(input.submissionDueAt)
      : undefined;
    const prepared = prepareHomeworkUpdate({
      dates: {
        hasPublishedAt,
        hasSubmissionDueAt,
        hasSubmissionStartAt,
        publishedAt,
        submissionDueAt,
        submissionStartAt,
      },
      description: hasDescription
        ? normalizeHomeworkDescription(input.description)
        : undefined,
      hasDescription,
      isMajor: input.isMajor,
      requiresTeam: input.requiresTeam,
      title:
        input.title == null ? undefined : normalizeHomeworkTitle(input.title),
      userId: principal.userId,
    });
    if (!prepared.ok) {
      badMutationInput(
        prepared.error === "no_changes"
          ? "No homework changes were provided."
          : prepared.message,
      );
    }

    const result = await updateHomework({
      audit: {
        ...attributionFromGraphqlPrincipal(principal),
        requestId: getAuditRequestMetadata(context.request).requestId,
      },
      homeworkId: id,
      update: prepared.update,
      userId: principal.userId,
    });
    if (!result.ok) handleHomeworkFailure(result, "Homework");

    const homework = await requireHomeworkItemById({
      homeworkId: id,
      locale: context.locale,
      userId: principal.userId,
    });
    return { id, homework };
  },
  async homeworkDelete(
    _parent: unknown,
    args: { id: string },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "community.section-homework",
    );
    const id = requireMutationId(args.id, "id");
    const result = await deleteHomework({
      audit: {
        ...attributionFromGraphqlPrincipal(principal),
        requestId: getAuditRequestMetadata(context.request).requestId,
      },
      homeworkId: id,
      userId: principal.userId,
    });
    if (!result.ok) handleHomeworkFailure(result, "Homework");
    return { id, success: true, alreadyDeleted: result.alreadyDeleted };
  },
  async homeworkCompletionSet(
    _parent: unknown,
    args: { completed: boolean; homeworkId: string },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "workspace.homework",
    );
    const result = await setHomeworkCompletion({
      completed: args.completed,
      homeworkId: requireMutationId(args.homeworkId, "homeworkId"),
      userId: principal.userId,
    });
    if (!result.success) mutationNotFound("Homework not found.");
    return result;
  },
  async homeworkCompletionsSet(
    _parent: unknown,
    args: { items: HomeworkCompletionBatchItemInput[] },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "workspace.homework",
      {
        rateLimitTier: "batch",
      },
    );
    const homeworkIds = normalizeBatchIds(
      args.items.map((item) => item.homeworkId),
      "homework IDs",
      100,
    );
    return setHomeworkCompletions({
      items: args.items.map((item, index) => ({
        completed: item.completed,
        homeworkId: homeworkIds[index],
      })),
      userId: principal.userId,
    });
  },
};
