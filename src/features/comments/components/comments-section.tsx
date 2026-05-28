"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataState } from "@/components/data-state";
import { SignInLink } from "@/components/sign-in-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardPanel } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useUploadsSummary } from "@/features/uploads/hooks/use-uploads-summary";
import { apiClient, extractApiErrorMessage } from "@/lib/api/client";
import {
  commentsListResponseSchema,
  commentUpdateResponseSchema,
  successResponseSchema,
} from "@/lib/api/schemas/response-schemas";
import { logClientError } from "@/lib/log/app-logger";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";
import { CommentEditor } from "./comment-editor";
import { CommentThread } from "./comment-thread";
import type {
  CommentNode,
  CommentTarget,
  CommentViewer,
} from "./comment-types";

type TargetOption = {
  key: string;
  label: string;
  type: CommentTarget["type"];
  targetId?: number;
  sectionId?: number;
  teacherId?: number;
  homeworkId?: string;
};

type TeacherOption = {
  id: number;
  label: string;
};

type CommentsSectionProps = {
  targets: TargetOption[];
  teacherOptions?: readonly TeacherOption[];
  showAllTargets?: boolean;
  initialData?: {
    commentMap: Record<string, CommentNode[]>;
    hiddenMap: Record<string, number>;
    hiddenCount: number;
    viewer: CommentViewer;
  };
};

const EMPTY_TEACHER_OPTIONS: readonly TeacherOption[] = [];

export function CommentsSection({
  targets,
  teacherOptions = EMPTY_TEACHER_OPTIONS,
  showAllTargets = false,
  initialData,
}: CommentsSectionProps) {
  const locale = useLocale();
  const t = useTranslations("comments");
  const [activeKey] = useState(targets[0]?.key ?? "");
  const [postTargetKey, setPostTargetKey] = useState(targets[0]?.key ?? "");
  const [commentMap, setCommentMap] = useState<Record<string, CommentNode[]>>(
    initialData?.commentMap ?? {},
  );
  const [hiddenCount, setHiddenCount] = useState(initialData?.hiddenCount ?? 0);
  const [viewer, setViewer] = useState<CommentViewer>(
    initialData?.viewer ?? {
      userId: null,
      name: null,
      image: null,
      isAdmin: false,
      isAuthenticated: false,
      isSuspended: false,
      suspensionReason: null,
      suspensionExpiresAt: null,
    },
  );
  const {
    uploads,
    summary: uploadSummary,
    addUpload,
  } = useUploadsSummary({
    enabled: viewer.isAuthenticated,
  });
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeacherId, _setSelectedTeacherId] = useState<number | null>(
    // By design: only the first teacher matters for section-teacher comments.
    teacherOptions[0]?.id ?? null,
  );
  const dateTimeFormatter = useMemo(
    () =>
      createShanghaiDateTimeFormatter(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const activeTarget = useMemo(
    () =>
      showAllTargets
        ? (targets[0] ?? null)
        : (targets.find((target) => target.key === activeKey) ?? targets[0]),
    [activeKey, showAllTargets, targets],
  );

  const comments = commentMap[activeKey] ?? [];

  const loadComments = useCallback(async () => {
    if (!activeTarget) return;
    setLoading(true);
    setError(null);
    if (
      !showAllTargets &&
      activeTarget.type === "section-teacher" &&
      !selectedTeacherId
    ) {
      setCommentMap({});
      setHiddenCount(0);
      setLoading(false);
      return;
    }
    try {
      const fetchTargets = showAllTargets ? targets : [activeTarget];
      const responses = await Promise.all(
        fetchTargets
          .filter((target) =>
            target.type === "section-teacher"
              ? Boolean(selectedTeacherId)
              : true,
          )
          .map(async (target) => {
            const params = new URLSearchParams();
            params.set("targetType", target.type);
            if (target.type === "homework" && target.homeworkId) {
              params.set("targetId", target.homeworkId);
            } else if (target.targetId) {
              params.set("targetId", String(target.targetId));
            }
            if (target.sectionId) {
              params.set("sectionId", String(target.sectionId));
            }
            if (target.teacherId) {
              params.set("teacherId", String(target.teacherId));
            }
            if (target.type === "section-teacher" && selectedTeacherId) {
              params.set("sectionId", String(target.sectionId));
              params.set("teacherId", String(selectedTeacherId));
            }

            const {
              data,
              error: errorBody,
              response,
            } = await apiClient.GET("/api/comments", {
              params: {
                query: {
                  targetType: params.get("targetType") ?? undefined,
                  targetId: params.get("targetId") ?? undefined,
                  sectionId: params.get("sectionId") ?? undefined,
                  teacherId: params.get("teacherId") ?? undefined,
                },
              },
            });

            if (!response.ok) {
              const apiMessage = extractApiErrorMessage(errorBody);
              throw new Error(apiMessage ?? "Failed to load comments");
            }

            const parsed = commentsListResponseSchema.safeParse(data);
            if (!parsed.success) {
              throw parsed.error;
            }

            return { key: target.key, data: parsed.data };
          }),
      );

      const nextMap: Record<string, CommentNode[]> = {};
      const nextHidden: Record<string, number> = {};
      let totalHidden = 0;
      for (const entry of responses) {
        nextMap[entry.key] = entry.data.comments;
        nextHidden[entry.key] = entry.data.hiddenCount;
        totalHidden += entry.data.hiddenCount;
      }

      setCommentMap(nextMap);
      setHiddenCount(totalHidden);
      const latestViewer = responses[0]?.data.viewer;
      if (latestViewer) {
        setViewer(latestViewer);
      }
    } catch (error) {
      logClientError("Failed to load comments", error, {
        component: "CommentsSection",
        activeKey,
        showAllTargets,
      });
      setError(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [activeKey, activeTarget, selectedTeacherId, showAllTargets, t, targets]);

  useEffect(() => {
    if (initialData) return;
    void loadComments();
  }, [initialData, loadComments]);

  const createComment = async (payload: {
    body: string;
    visibility: string;
    isAnonymous: boolean;
    attachmentIds: string[];
    parentId?: string;
  }) => {
    const visibility: "public" | "logged_in_only" | "anonymous" =
      payload.visibility === "public" ||
      payload.visibility === "logged_in_only" ||
      payload.visibility === "anonymous"
        ? payload.visibility
        : "public";

    const targetForPost =
      targets.find((target) => target.key === postTargetKey) ?? activeTarget;
    if (!targetForPost) return;
    if (targetForPost.type === "section-teacher" && !selectedTeacherId) {
      throw new Error("Teacher required");
    }
    const { error: errorBody, response } = await apiClient.POST(
      "/api/comments",
      {
        body: {
          targetType: targetForPost.type,
          targetId:
            targetForPost.type === "homework"
              ? (targetForPost.homeworkId ?? undefined)
              : (targetForPost.targetId ?? undefined),
          sectionId: targetForPost.sectionId ?? undefined,
          teacherId:
            targetForPost.type === "section-teacher"
              ? (selectedTeacherId ?? undefined)
              : (targetForPost.teacherId ?? undefined),
          body: payload.body,
          visibility,
          isAnonymous: payload.isAnonymous,
          parentId: payload.parentId ?? null,
          attachmentIds: payload.attachmentIds,
        },
      },
    );

    if (!response.ok) {
      const apiMessage = extractApiErrorMessage(errorBody);
      throw new Error(apiMessage ?? "Failed to create comment");
    }

    await loadComments();
  };

  const handleReply = async (
    parentId: string,
    payload: {
      body: string;
      visibility: string;
      isAnonymous: boolean;
      attachmentIds: string[];
    },
  ) => {
    await createComment({ ...payload, parentId });
  };

  const handleEdit = async (
    commentId: string,
    payload: {
      body: string;
      attachmentIds: string[];
      visibility?: string;
      isAnonymous?: boolean;
    },
  ) => {
    const visibility: "public" | "logged_in_only" | "anonymous" | undefined =
      payload.visibility === "public" ||
      payload.visibility === "logged_in_only" ||
      payload.visibility === "anonymous"
        ? payload.visibility
        : undefined;

    const {
      data,
      error: errorBody,
      response,
    } = await apiClient.PATCH("/api/comments/{id}", {
      params: {
        path: {
          id: commentId,
        },
      },
      body: {
        body: payload.body,
        attachmentIds: payload.attachmentIds,
        visibility,
        isAnonymous: payload.isAnonymous,
      },
    });

    if (!response.ok) {
      const apiMessage = extractApiErrorMessage(errorBody);
      throw new Error(apiMessage ?? "Failed to update comment");
    }

    const parsed = commentUpdateResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw parsed.error;
    }

    const { comment } = parsed.data;
    if (comment) {
      const updateNodes = (nodes: CommentNode[]): CommentNode[] => {
        return nodes.map((node) => {
          if (node.id === commentId) {
            return { ...comment, replies: node.replies };
          }
          if (node.replies && node.replies.length > 0) {
            return { ...node, replies: updateNodes(node.replies) };
          }
          return node;
        });
      };

      setCommentMap((prev) => ({
        ...prev,
        [activeKey]: updateNodes(prev[activeKey] ?? []),
      }));
    }
  };

  const handleDelete = async (commentId: string) => {
    const {
      data,
      error: errorBody,
      response,
    } = await apiClient.DELETE("/api/comments/{id}", {
      params: {
        path: {
          id: commentId,
        },
      },
    });

    if (!response.ok) {
      const apiMessage = extractApiErrorMessage(errorBody);
      throw new Error(apiMessage ?? "Failed to delete comment");
    }

    const parsed = successResponseSchema.safeParse(data);
    if (!parsed.success || !parsed.data.success) {
      throw new Error("Failed to delete comment");
    }

    await loadComments();
  };

  const renderThread = () => {
    if (showAllTargets) {
      if (activeTarget?.type === "section-teacher" && !selectedTeacherId) {
        return (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("selectTeacherPrompt")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        );
      }

      const combinedComments = targets.flatMap((target) =>
        (commentMap[target.key] ?? []).map((comment) => ({
          ...comment,
          contextLabel: target.label,
        })),
      );

      return (
        <DataState
          loading={loading}
          error={error}
          onRetry={() => void loadComments()}
          retryLabel={t("retry")}
          empty={combinedComments.length === 0}
          emptyTitle={t("emptyTitle")}
        >
          <div className="space-y-3">
            <CommentThread
              comments={combinedComments}
              viewer={viewer}
              uploads={uploads}
              uploadSummary={uploadSummary}
              onUploadComplete={addUpload}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </div>
        </DataState>
      );
    }

    return (
      <DataState
        loading={loading}
        error={error}
        onRetry={() => void loadComments()}
        retryLabel={t("retry")}
        empty={comments.length === 0}
        emptyTitle={t("emptyTitle")}
      >
        <CommentThread
          comments={comments}
          viewer={viewer}
          uploads={uploads}
          uploadSummary={uploadSummary}
          onUploadComplete={addUpload}
          onReply={handleReply}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </DataState>
    );
  };

  const threadContent = showAllTargets ? null : renderThread();

  const content = (
    <div className="space-y-6">
      {viewer.isSuspended && (
        <Alert variant="error">
          <AlertTitle>{t("suspendedTitle")}</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>{t("suspendedMessage")}</p>
            {viewer.suspensionReason && (
              <p className="text-sm">
                {t("suspendedReason", { reason: viewer.suspensionReason })}
              </p>
            )}
            {viewer.suspensionExpiresAt ? (
              <p className="text-sm">
                {t("suspendedExpires", {
                  date: dateTimeFormatter.format(
                    new Date(viewer.suspensionExpiresAt),
                  ),
                })}
              </p>
            ) : (
              <p className="font-semibold text-sm">{t("suspendedPermanent")}</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardPanel className="space-y-4">
          <CommentEditor
            viewer={viewer}
            uploads={uploads}
            uploadSummary={uploadSummary}
            onUploadComplete={addUpload}
            submitLabel={t("postAction")}
            onSubmit={(payload) => createComment(payload)}
            targetOptions={
              targets.length > 1
                ? targets.map((target) => ({
                    value: target.key,
                    label: target.label,
                  }))
                : undefined
            }
            targetValue={postTargetKey}
            onTargetChange={(value) => setPostTargetKey(value)}
          />
        </CardPanel>
      </Card>

      {threadContent}

      {hiddenCount > 0 && !viewer.isAuthenticated && (
        <Card className="border-dashed bg-muted/40">
          <CardPanel className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              {t("hiddenNotice", { count: hiddenCount })}
            </p>
            <Button
              size="sm"
              variant="outline"
              render={<SignInLink className="no-underline" />}
            >
              {t("loginToView")}
            </Button>
          </CardPanel>
        </Card>
      )}
    </div>
  );

  if (targets.length <= 1) {
    return content;
  }

  return (
    <div className="space-y-4">
      {content}
      {showAllTargets && renderThread()}
    </div>
  );
}
