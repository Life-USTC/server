import { normalizeContentType } from "@/features/uploads/lib/upload-utils";
import {
  completeOwnedUploadSession,
  createOwnedUploadSession,
  deleteOwnedUpload,
  renameOwnedUpload,
} from "@/features/uploads/server/upload-service";
import { attributionFromGraphqlPrincipal } from "@/lib/audit/principal-attribution";
import { getAuditRequestMetadata } from "@/lib/audit/write-audit-log";
import type { GraphqlContext } from "../context";
import { requireGraphqlMutation } from "../mutation-guard";
import { rejectExplicitNullFields, requireMutationId } from "../mutation-input";
import {
  handleUploadError,
  handleUploadFailure,
  normalizeUploadFilename,
  normalizeUploadSize,
} from "./shared";

type CreateUploadSessionInput = {
  contentType?: string | null;
  filename: string;
  size: number;
};

type CompleteUploadSessionInput = {
  contentType?: string | null;
  filename: string;
  key: string;
};

export const uploadMutationResolvers = {
  async uploadSessionCreate(
    _parent: unknown,
    args: { input: CreateUploadSessionInput },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(context, "workspace.upload");
    rejectExplicitNullFields(args.input, ["contentType"]);
    try {
      const result = await createOwnedUploadSession({
        origin: new URL(context.request.url).origin,
        upload: {
          contentType: normalizeContentType(args.input.contentType),
          filename: normalizeUploadFilename(args.input.filename),
          size: normalizeUploadSize(args.input.size),
        },
        userId: principal.userId,
      });
      if (!result.ok) handleUploadFailure(result);
      return result.session;
    } catch (error) {
      return handleUploadError(error);
    }
  },
  async uploadSessionComplete(
    _parent: unknown,
    args: { input: CompleteUploadSessionInput },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(context, "workspace.upload");
    rejectExplicitNullFields(args.input, ["contentType"]);
    try {
      const result = await completeOwnedUploadSession(principal.userId, {
        contentType:
          args.input.contentType == null
            ? undefined
            : normalizeContentType(args.input.contentType),
        filename: normalizeUploadFilename(args.input.filename),
        key: requireMutationId(args.input.key, "key"),
      });
      if (!result.ok) handleUploadFailure(result);
      return result.completion;
    } catch (error) {
      return handleUploadError(error);
    }
  },
  async uploadRename(
    _parent: unknown,
    args: { filename: string; id: string },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(context, "workspace.upload");
    const result = await renameOwnedUpload({
      filename: normalizeUploadFilename(args.filename, 255),
      id: requireMutationId(args.id, "id"),
      userId: principal.userId,
    });
    if (!result.ok) handleUploadFailure(result);
    return { upload: result.upload };
  },
  async uploadDelete(
    _parent: unknown,
    args: { id: string },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(context, "workspace.upload");
    const id = requireMutationId(args.id, "id");
    const result = await deleteOwnedUpload({
      audit: {
        ...getAuditRequestMetadata(context.request),
        ...attributionFromGraphqlPrincipal(principal),
        source: "graphql",
      },
      id,
      userId: principal.userId,
    });
    if (!result.ok) handleUploadFailure(result);
    return {
      id: result.deletedId,
      success: true,
      deletedSize: result.deletedSize,
    };
  },
};
