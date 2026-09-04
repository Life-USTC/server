import { DESCRIPTION_CONTENT_MAX_LENGTH } from "@/features/descriptions/lib/description-limits";
import {
  type DescriptionTargetType,
  resolveDescriptionTargetReference,
} from "@/features/descriptions/server/description-targets";
import { upsertDescriptionContent } from "@/features/descriptions/server/description-upsert";
import { attributionFromGraphqlPrincipal } from "@/lib/audit/principal-attribution";
import { getAuditRequestMetadata } from "@/lib/audit/write-audit-log";
import type { GraphqlContext } from "../context";
import { validateOptionalGraphqlId } from "../input-boundaries";
import { badMutationInput, mutationNotFound } from "../mutation-errors";
import { requireGraphqlMutation } from "../mutation-guard";
import { rejectExplicitNullFields, requireMutationId } from "../mutation-input";
import { handleDescriptionFailure } from "./shared";

type UpsertDescriptionInput = {
  content: string;
  courseJwId?: number | null;
  homeworkId?: string | null;
  sectionJwId?: number | null;
  targetId?: string | null;
  targetType: DescriptionTargetType;
  teacherId?: number | null;
};

export const descriptionTargetTypeResolver = {
  COURSE: "course",
  SECTION: "section",
  TEACHER: "teacher",
  HOMEWORK: "homework",
} as const satisfies Record<string, DescriptionTargetType>;

export const descriptionMutationResolvers = {
  async descriptionSet(
    _parent: unknown,
    args: { input: UpsertDescriptionInput },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "community.description",
    );
    const input = args.input;
    rejectExplicitNullFields(input, [
      "targetId",
      "sectionJwId",
      "courseJwId",
      "teacherId",
      "homeworkId",
    ]);
    if (input.content.length > DESCRIPTION_CONTENT_MAX_LENGTH) {
      badMutationInput(
        `content must not exceed ${DESCRIPTION_CONTENT_MAX_LENGTH} characters.`,
      );
    }
    const content = input.content.trim();

    const target = await resolveDescriptionTargetReference({
      courseJwId: validateOptionalGraphqlId(input.courseJwId, "courseJwId"),
      homeworkId:
        input.homeworkId == null
          ? undefined
          : requireMutationId(input.homeworkId, "homeworkId"),
      rawTargetId:
        input.targetId == null
          ? undefined
          : requireMutationId(input.targetId, "targetId"),
      sectionJwId: validateOptionalGraphqlId(input.sectionJwId, "sectionJwId"),
      targetType: input.targetType,
      teacherId: validateOptionalGraphqlId(input.teacherId, "teacherId"),
      verifyExistence: true,
    });
    if (!target.ok) {
      if (target.error === "target_not_found") {
        mutationNotFound("Description target not found.");
      }
      badMutationInput("Invalid description target.");
    }

    const result = await upsertDescriptionContent({
      auditMetadata: {
        ...getAuditRequestMetadata(context.request),
        ...attributionFromGraphqlPrincipal(principal),
        source: "graphql",
      },
      content,
      targetId: target.targetId,
      targetType: target.targetType,
      userId: principal.userId,
    });
    if (!result.ok) handleDescriptionFailure(result);
    return { id: result.id, updated: result.updated };
  },
};
