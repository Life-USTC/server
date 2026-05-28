"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { DataState } from "@/components/data-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardPanel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUploadsSummary } from "@/features/uploads/hooks/use-uploads-summary";
import { Link } from "@/i18n/routing";
import { apiClient, extractApiErrorMessage } from "@/lib/api/client";
import {
  commentThreadResponseSchema,
  commentUpdateResponseSchema,
  successResponseSchema,
} from "@/lib/api/schemas/response-schemas";
import { CommentEditor } from "./comment-editor";
import { CommentThread } from "./comment-thread";
import type { CommentNode, CommentViewer } from "./comment-types";

type ThreadResponse = {
  thread: CommentNode[];
  focusId: string;
  hiddenCount: number;
  viewer: CommentViewer;
  target: {
    sectionId?: number | null;
    courseId?: number | null;
    teacherId?: number | null;
    sectionTeacherId?: number | null;
    sectionTeacherSectionId?: number | null;
    sectionTeacherTeacherId?: number | null;
    sectionTeacherSectionJwId?: number | null;
    sectionTeacherSectionCode?: string | null;
    sectionTeacherTeacherName?: string | null;
    sectionTeacherCourseJwId?: number | null;
    sectionTeacherCourseName?: string | null;
    homeworkId?: string | null;
    homeworkTitle?: string | null;
    homeworkSectionJwId?: number | null;
    homeworkSectionCode?: string | null;
    sectionJwId?: number | null;
    sectionCode?: string | null;
    courseJwId?: number | null;
    courseName?: string | null;
    teacherName?: string | null;
  };
};

type CommentThreadPageProps = {
  commentId: string;
};

export function CommentThreadPage({ commentId }: CommentThreadPageProps) {
  const t = useTranslations("comments");
  const [thread, setThread] = useState<CommentNode[]>([]);
  const [viewer, setViewer] = useState<CommentViewer>({
    userId: null,
    name: null,
    image: null,
    isAdmin: false,
    isAuthenticated: false,
    isSuspended: false,
    suspensionReason: null,
    suspensionExpiresAt: null,
  });
  const {
    uploads,
    summary: uploadSummary,
    addUpload,
  } = useUploadsSummary({
    enabled: viewer.isAuthenticated,
  });
  const [focusId, setFocusId] = useState(commentId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<ThreadResponse["target"]>({});

  const loadThread = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.GET("/api/comments/{id}", {
        params: {
          path: { id: commentId },
        },
      });

      if (!result.response.ok || !result.data) {
        const apiMessage = extractApiErrorMessage(result.error);
        throw new Error(apiMessage ?? "Failed to load");
      }

      const parsed = commentThreadResponseSchema.safeParse(result.data);
      if (!parsed.success) {
        throw new Error("Failed to load");
      }

      setThread(parsed.data.thread);
      setViewer(parsed.data.viewer);
      setFocusId(parsed.data.focusId);
      setTarget(parsed.data.target ?? {});
    } catch (error) {
      console.error("Failed to load comment thread", error);
      setError(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [commentId, t]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  const createReply = async (payload: {
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

    let targetType:
      | "section"
      | "section-teacher"
      | "homework"
      | "course"
      | "teacher" = "section";
    let targetId: number | null = null;
    let sectionId: number | null = null;
    let teacherId: number | null = null;
    let homeworkId: string | null = null;

    if (target.sectionTeacherId) {
      targetType = "section-teacher";
      sectionId = target.sectionTeacherSectionId ?? null;
      teacherId = target.sectionTeacherTeacherId ?? null;
    } else if (target.homeworkId) {
      targetType = "homework";
      homeworkId = target.homeworkId ?? null;
    } else if (target.courseId) {
      targetType = "course";
      targetId = target.courseId ?? null;
    } else if (target.teacherId) {
      targetType = "teacher";
      targetId = target.teacherId ?? null;
    } else if (target.sectionId) {
      targetType = "section";
      targetId = target.sectionId ?? null;
    }

    const payloadTargetId = targetType === "homework" ? homeworkId : targetId;

    const result = await apiClient.POST("/api/comments", {
      body: {
        targetType,
        targetId: payloadTargetId ?? undefined,
        sectionId: sectionId ?? undefined,
        teacherId: teacherId ?? undefined,
        body: payload.body,
        visibility,
        isAnonymous: payload.isAnonymous,
        parentId: payload.parentId ?? null,
        attachmentIds: payload.attachmentIds,
      },
    });

    if (!result.response.ok) {
      const apiMessage = extractApiErrorMessage(result.error);
      throw new Error(apiMessage ?? "Failed to create reply");
    }

    await loadThread();
  };

  const handleEdit = async (
    commentIdValue: string,
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

    const result = await apiClient.PATCH("/api/comments/{id}", {
      params: {
        path: { id: commentIdValue },
      },
      body: {
        body: payload.body,
        attachmentIds: payload.attachmentIds,
        visibility,
        isAnonymous: payload.isAnonymous,
      },
    });

    if (!result.response.ok || !result.data) {
      const apiMessage = extractApiErrorMessage(result.error);
      throw new Error(apiMessage ?? "Failed to update comment");
    }

    const parsed = commentUpdateResponseSchema.safeParse(result.data);
    if (!parsed.success || !parsed.data.success) {
      throw new Error("Failed to update comment");
    }

    await loadThread();
  };

  const handleDelete = async (commentIdValue: string) => {
    const result = await apiClient.DELETE("/api/comments/{id}", {
      params: {
        path: { id: commentIdValue },
      },
    });

    if (!result.response.ok || !result.data) {
      const apiMessage = extractApiErrorMessage(result.error);
      throw new Error(apiMessage ?? "Failed to delete comment");
    }

    const parsed = successResponseSchema.safeParse(result.data);
    if (!parsed.success || !parsed.data.success) {
      throw new Error("Failed to delete comment");
    }

    await loadThread();
  };

  return (
    <DataState
      loading={loading}
      error={error}
      onRetry={() => void loadThread()}
      retryLabel={t("retry")}
      empty={false}
      loadingFallback={
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardPanel className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-base">{t("threadTitle")}</h3>
                <p className="text-muted-foreground text-sm">
                  {t("threadSubtitle")}
                </p>
              </div>
              {viewer.isAuthenticated ? (
                <Badge variant="secondary">{t("loggedInBadge")}</Badge>
              ) : (
                <Badge variant="outline">{t("guestBadge")}</Badge>
              )}
            </div>
            <CommentEditor
              viewer={viewer}
              uploads={uploads}
              uploadSummary={uploadSummary}
              onUploadComplete={addUpload}
              submitLabel={t("postReply")}
              onSubmit={(payload) => createReply(payload)}
            />
          </CardPanel>
        </Card>

        {(target.sectionJwId ||
          target.courseJwId ||
          target.teacherId ||
          target.sectionTeacherSectionJwId ||
          target.sectionTeacherCourseJwId ||
          target.homeworkId) && (
          <Card>
            <CardPanel className="flex flex-wrap gap-3">
              {target.homeworkId && target.homeworkSectionJwId && (
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link
                      className="no-underline"
                      href={`/sections/${target.homeworkSectionJwId}#homework-${target.homeworkId}`}
                    />
                  }
                >
                  {target.homeworkTitle ?? t("viewHomework")}
                </Button>
              )}
              {target.sectionTeacherSectionJwId ? (
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link
                      className="no-underline"
                      href={`/sections/${target.sectionTeacherSectionJwId}`}
                    />
                  }
                >
                  {target.sectionTeacherSectionCode ?? t("viewSection")}
                </Button>
              ) : (
                target.sectionJwId && (
                  <Button
                    size="sm"
                    variant="outline"
                    render={
                      <Link
                        className="no-underline"
                        href={`/sections/${target.sectionJwId}`}
                      />
                    }
                  >
                    {target.sectionCode ?? t("viewSection")}
                  </Button>
                )
              )}
              {target.sectionTeacherCourseJwId ? (
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link
                      className="no-underline"
                      href={`/courses/${target.sectionTeacherCourseJwId}`}
                    />
                  }
                >
                  {target.sectionTeacherCourseName ?? t("viewCourse")}
                </Button>
              ) : (
                target.courseJwId && (
                  <Button
                    size="sm"
                    variant="outline"
                    render={
                      <Link
                        className="no-underline"
                        href={`/courses/${target.courseJwId}`}
                      />
                    }
                  >
                    {target.courseName ?? t("viewCourse")}
                  </Button>
                )
              )}
              {target.sectionTeacherTeacherId ? (
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link
                      className="no-underline"
                      href={`/teachers/${target.sectionTeacherTeacherId}`}
                    />
                  }
                >
                  {target.sectionTeacherTeacherName ?? t("viewTeacher")}
                </Button>
              ) : (
                target.teacherId && (
                  <Button
                    size="sm"
                    variant="outline"
                    render={
                      <Link
                        className="no-underline"
                        href={`/teachers/${target.teacherId}`}
                      />
                    }
                  >
                    {target.teacherName ?? t("viewTeacher")}
                  </Button>
                )
              )}
            </CardPanel>
          </Card>
        )}

        <CommentThread
          comments={thread}
          viewer={viewer}
          uploads={uploads}
          uploadSummary={uploadSummary}
          onUploadComplete={addUpload}
          onReply={(parentId, payload) => createReply({ ...payload, parentId })}
          onEdit={handleEdit}
          onDelete={handleDelete}
          highlightId={focusId}
        />
      </div>
    </DataState>
  );
}
