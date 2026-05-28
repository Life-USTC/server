"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DataState } from "@/components/data-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiClient, extractApiErrorMessage } from "@/lib/api/client";
import {
  adminCommentsResponseSchema,
  adminDescriptionsResponseSchema,
} from "@/lib/api/schemas/response-schemas";
import { logClientError } from "@/lib/log/app-logger";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import {
  addShanghaiTime,
  createShanghaiDateTimeFormatter,
  parseShanghaiDateTimeLocalInput,
} from "@/lib/time/shanghai-format";
import { stableSkeletonKeys } from "@/lib/ui/skeleton-keys";
import { CommentDetailDialog } from "./comment-detail-dialog";
import { CommentFilters } from "./comment-filters";
import { CommentsTable } from "./comments-table";
import { DescriptionDetailDialog } from "./description-detail-dialog";
import { DescriptionFilters } from "./description-filters";
import { DescriptionsTable } from "./descriptions-table";
import type {
  AdminComment,
  AdminDescription,
  CommentStatus,
  CommentStatusFilter,
  DescriptionContentFilter,
} from "./moderation-types";

type ModerationDashboardProps = {
  initialSearchQuery?: string;
};

export function ModerationDashboard({
  initialSearchQuery = "",
}: ModerationDashboardProps) {
  const locale = useLocale();
  const t = useTranslations("moderation");
  const { toast } = useToast();
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [descriptions, setDescriptions] = useState<AdminDescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<CommentStatusFilter>("active");
  // Note: descriptionTargetTab was used by the previous nested-tab design.
  const [descriptionContentFilter, setDescriptionContentFilter] =
    useState<DescriptionContentFilter>("withContent");
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedComment, setSelectedComment] = useState<AdminComment | null>(
    null,
  );
  const [updateStatus, setUpdateStatus] = useState<CommentStatus>("active");
  const [updateNote, setUpdateNote] = useState("");

  const [suspendDuration, setSuspendDuration] = useState("3d");
  const [suspendExpiresAt, setSuspendExpiresAt] = useState("");
  const [suspendReason, setSuspendReason] = useState("");

  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [selectedDescription, setSelectedDescription] =
    useState<AdminDescription | null>(null);
  const dateTimeFormatter = useMemo(
    () =>
      createShanghaiDateTimeFormatter(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const formatTimestamp = useCallback(
    (value: string | Date) => dateTimeFormatter.format(new Date(value)),
    [dateTimeFormatter],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const commentPromise =
        statusFilter === "all"
          ? apiClient.GET("/api/admin/comments")
          : apiClient.GET("/api/admin/comments", {
              params: {
                query: { status: statusFilter },
              },
            });

      const descriptionsPromise = apiClient.GET("/api/admin/descriptions", {
        params: {
          query: { targetType: "all", hasContent: "withContent", limit: "200" },
        },
      });

      const [commentResult, descriptionsResult] = await Promise.all([
        commentPromise,
        descriptionsPromise,
      ]);

      if (!commentResult.response.ok || !commentResult.data) {
        throw new Error(
          extractApiErrorMessage(commentResult.error) ??
            "Failed to load moderation comments",
        );
      }

      const parsedComments = adminCommentsResponseSchema.safeParse(
        commentResult.data,
      );
      if (!parsedComments.success) {
        throw new Error("Invalid moderation comments payload");
      }

      if (!descriptionsResult.response.ok || !descriptionsResult.data) {
        throw new Error(
          extractApiErrorMessage(descriptionsResult.error) ??
            "Failed to load moderation descriptions",
        );
      }

      const parsedDescriptions = adminDescriptionsResponseSchema.safeParse(
        descriptionsResult.data,
      );
      if (!parsedDescriptions.success) {
        throw new Error("Invalid moderation descriptions payload");
      }

      setComments(parsedComments.data.comments);
      setDescriptions(parsedDescriptions.data.descriptions);
    } catch (error) {
      logClientError("Failed to load moderation data", error, {
        component: "ModerationDashboard",
      });
      setComments([]);
      setDescriptions([]);
      setError(t("updateFailed"));
      toast({
        title: t("updateFailed"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, t, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getTargetLink = (comment: AdminComment) => {
    let url = "/";
    let label = t("unknownTarget");

    if (comment.homework?.id) {
      url = `/comments/${comment.id}`;
      const sectionCode = comment.homework.section?.code ?? "";
      const homeworkTitle = comment.homework.title ?? "";
      label = [sectionCode, homeworkTitle].filter(Boolean).join(" · ");
    } else if (comment.sectionTeacher?.section?.jwId) {
      url = `/sections/${comment.sectionTeacher.section.jwId}`;
      label =
        comment.sectionTeacher.section.course?.nameCn ??
        comment.sectionTeacher.section.code ??
        t("unknownTarget");
    } else if (comment.section?.jwId) {
      url = `/sections/${comment.section.jwId}`;
      label =
        comment.section.course?.nameCn ??
        comment.section.code ??
        t("unknownTarget");
    } else if (comment.course?.jwId) {
      url = `/courses/${comment.course.jwId}`;
      label =
        comment.course.nameCn ?? comment.course.code ?? t("unknownTarget");
    } else if (comment.teacher?.id) {
      url = `/teachers/${comment.teacher.id}`;
      label = comment.teacher.nameCn;
    }

    return {
      href: `${url}#comment-${comment.id}`,
      label,
    };
  };

  const openDetailDialog = (comment: AdminComment) => {
    setSelectedComment(comment);
    setUpdateStatus(comment.status);
    setUpdateNote(comment.moderationNote ?? "");
    setSuspendDuration("3d");
    setSuspendExpiresAt("");

    const targetLink = getTargetLink(comment);
    const date = formatTimestamp(comment.createdAt);
    const bodySnippet =
      comment.body.length > 50
        ? `${comment.body.slice(0, 50)}...`
        : comment.body;
    const reason = t("defaultBanReason", {
      date,
      url: window.location.origin + targetLink.href,
      content: bodySnippet,
    });
    setSuspendReason(reason);
    setDetailDialogOpen(true);
  };

  const openDescriptionDialog = (description: AdminDescription) => {
    setSelectedDescription(description);
    setDescriptionDialogOpen(true);
  };

  const calculateExpiresAt = () => {
    if (suspendDuration === "permanent") return undefined;
    if (suspendDuration === "custom") {
      const parsed = parseShanghaiDateTimeLocalInput(suspendExpiresAt);
      return parsed ? toShanghaiIsoString(parsed) : undefined;
    }

    const amount =
      suspendDuration === "1d"
        ? 1
        : suspendDuration === "3d"
          ? 3
          : suspendDuration === "7d"
            ? 7
            : suspendDuration === "30d"
              ? 30
              : null;

    return amount === null
      ? undefined
      : toShanghaiIsoString(addShanghaiTime(new Date(), amount, "day"));
  };

  const handleUpdateStatus = async () => {
    if (!selectedComment) return;
    try {
      const result = await apiClient.PATCH("/api/admin/comments/{id}", {
        params: {
          path: { id: selectedComment.id },
        },
        body: {
          status: updateStatus,
          moderationNote: updateNote.trim() || null,
        },
      });

      if (!result.response.ok) {
        const apiMessage = extractApiErrorMessage(result.error);
        throw new Error(apiMessage ?? "Failed to update comment");
      }
      toast({
        title: t("updateSuccess"),
        variant: "success",
      });
      await loadData();
      setDetailDialogOpen(false);
    } catch (error) {
      logClientError("Failed to update comment", error, {
        component: "ModerationDashboard",
        commentId: selectedComment?.id ?? null,
      });
      toast({
        title: t("updateFailed"),
        variant: "destructive",
      });
    }
  };

  const handleSuspendUser = async () => {
    if (!selectedComment?.userId) return;
    try {
      const expiresAt = calculateExpiresAt();
      const result = await apiClient.POST("/api/admin/suspensions", {
        body: {
          userId: selectedComment.userId,
          reason: suspendReason.trim() || undefined,
          expiresAt,
        },
      });

      if (!result.response.ok) {
        const apiMessage = extractApiErrorMessage(result.error);
        throw new Error(apiMessage ?? "Failed to suspend user");
      }
      toast({
        title: t("suspendSuccess"),
        variant: "success",
      });
      await loadData();
      setDetailDialogOpen(false);
    } catch (error) {
      logClientError("Failed to suspend user", error, {
        component: "ModerationDashboard",
        commentId: selectedComment?.id ?? null,
      });
      toast({
        title: t("suspendFailed"),
        variant: "destructive",
      });
    }
  };

  // Suspensions tab removed; lifting suspensions is not handled here.

  const filteredComments = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (!query) return comments;
    return comments.filter(
      (c) =>
        c.body?.toLowerCase().includes(query) ||
        c.user?.name?.toLowerCase().includes(query) ||
        c.authorName?.toLowerCase().includes(query),
    );
  }, [comments, deferredSearchQuery]);

  const filteredDescriptionsAll = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    return descriptions.filter((d) => {
      const hasContent = Boolean(d.content?.trim());
      if (descriptionContentFilter === "withContent" && !hasContent)
        return false;
      if (descriptionContentFilter === "empty" && hasContent) return false;

      if (!query) return true;
      const haystack = [
        d.content,
        d.homework?.title ?? "",
        d.homework?.section?.code ?? "",
        d.homework?.section?.course?.code ?? "",
        d.homework?.section?.course?.nameCn ?? "",
        d.course?.code ?? "",
        d.course?.nameCn ?? "",
        d.section?.code ?? "",
        d.section?.course?.code ?? "",
        d.section?.course?.nameCn ?? "",
        d.teacher?.nameCn ?? "",
        d.lastEditedBy?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [deferredSearchQuery, descriptions, descriptionContentFilter]);

  const filteredDescriptionsHomework = useMemo(
    () => filteredDescriptionsAll.filter((d) => Boolean(d.homework)),
    [filteredDescriptionsAll],
  );
  const filteredDescriptionsCourse = useMemo(
    () => filteredDescriptionsAll.filter((d) => Boolean(d.course)),
    [filteredDescriptionsAll],
  );
  const filteredDescriptionsSection = useMemo(
    () => filteredDescriptionsAll.filter((d) => Boolean(d.section)),
    [filteredDescriptionsAll],
  );
  const filteredDescriptionsTeacher = useMemo(
    () => filteredDescriptionsAll.filter((d) => Boolean(d.teacher)),
    [filteredDescriptionsAll],
  );

  return (
    <>
      <Tabs defaultValue="comments">
        <TabsList variant="pill">
          <TabsTab value="comments" variant="pill">
            {t("commentsTab")} ({comments.length})
          </TabsTab>
          <TabsTab value="description-homework" variant="pill">
            {t("descriptionTargetHomework")} (
            {filteredDescriptionsHomework.length})
          </TabsTab>
          <TabsTab value="description-course" variant="pill">
            {t("descriptionTargetCourse")} ({filteredDescriptionsCourse.length})
          </TabsTab>
          <TabsTab value="description-section" variant="pill">
            {t("descriptionTargetSection")} (
            {filteredDescriptionsSection.length})
          </TabsTab>
          <TabsTab value="description-teacher" variant="pill">
            {t("descriptionTargetTeacher")} (
            {filteredDescriptionsTeacher.length})
          </TabsTab>
        </TabsList>

        <TabsPanel value="comments">
          <CommentFilters
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            onSearchChange={setSearchQuery}
            onStatusChange={setStatusFilter}
            t={t}
          />

          <DataState
            loading={loading}
            error={error}
            onRetry={() => void loadData()}
            retryLabel={t("retry")}
            empty={filteredComments.length === 0}
            emptyDescription={t("noResults")}
            loadingFallback={<ModerationTableSkeleton />}
          >
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                {t("showingResults", { count: filteredComments.length })}
              </p>
              <CommentsTable
                comments={filteredComments}
                formatTimestamp={formatTimestamp}
                onSelect={openDetailDialog}
                getTargetLink={getTargetLink}
                t={t}
              />
            </div>
          </DataState>
        </TabsPanel>

        <TabsPanel value="description-homework">
          <DescriptionFilters
            searchQuery={searchQuery}
            contentFilter={descriptionContentFilter}
            onSearchChange={setSearchQuery}
            onContentChange={setDescriptionContentFilter}
            t={t}
          />

          <DataState
            loading={loading}
            error={error}
            onRetry={() => void loadData()}
            retryLabel={t("retry")}
            empty={filteredDescriptionsHomework.length === 0}
            emptyDescription={t("noResults")}
            loadingFallback={<ModerationTableSkeleton />}
          >
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                {t("showingResults", {
                  count: filteredDescriptionsHomework.length,
                })}
              </p>
              <DescriptionsTable
                descriptions={filteredDescriptionsHomework}
                formatTimestamp={formatTimestamp}
                onSelect={openDescriptionDialog}
                t={t}
              />
            </div>
          </DataState>
        </TabsPanel>

        <TabsPanel value="description-course">
          <DescriptionFilters
            searchQuery={searchQuery}
            contentFilter={descriptionContentFilter}
            onSearchChange={setSearchQuery}
            onContentChange={setDescriptionContentFilter}
            t={t}
          />

          <DataState
            loading={loading}
            error={error}
            onRetry={() => void loadData()}
            retryLabel={t("retry")}
            empty={filteredDescriptionsCourse.length === 0}
            emptyDescription={t("noResults")}
            loadingFallback={<ModerationTableSkeleton />}
          >
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                {t("showingResults", {
                  count: filteredDescriptionsCourse.length,
                })}
              </p>
              <DescriptionsTable
                descriptions={filteredDescriptionsCourse}
                formatTimestamp={formatTimestamp}
                onSelect={openDescriptionDialog}
                t={t}
              />
            </div>
          </DataState>
        </TabsPanel>

        <TabsPanel value="description-section">
          <DescriptionFilters
            searchQuery={searchQuery}
            contentFilter={descriptionContentFilter}
            onSearchChange={setSearchQuery}
            onContentChange={setDescriptionContentFilter}
            t={t}
          />

          <DataState
            loading={loading}
            error={error}
            onRetry={() => void loadData()}
            retryLabel={t("retry")}
            empty={filteredDescriptionsSection.length === 0}
            emptyDescription={t("noResults")}
            loadingFallback={<ModerationTableSkeleton />}
          >
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                {t("showingResults", {
                  count: filteredDescriptionsSection.length,
                })}
              </p>
              <DescriptionsTable
                descriptions={filteredDescriptionsSection}
                formatTimestamp={formatTimestamp}
                onSelect={openDescriptionDialog}
                t={t}
              />
            </div>
          </DataState>
        </TabsPanel>

        <TabsPanel value="description-teacher">
          <DescriptionFilters
            searchQuery={searchQuery}
            contentFilter={descriptionContentFilter}
            onSearchChange={setSearchQuery}
            onContentChange={setDescriptionContentFilter}
            t={t}
          />

          <DataState
            loading={loading}
            error={error}
            onRetry={() => void loadData()}
            retryLabel={t("retry")}
            empty={filteredDescriptionsTeacher.length === 0}
            emptyDescription={t("noResults")}
            loadingFallback={<ModerationTableSkeleton />}
          >
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                {t("showingResults", {
                  count: filteredDescriptionsTeacher.length,
                })}
              </p>
              <DescriptionsTable
                descriptions={filteredDescriptionsTeacher}
                formatTimestamp={formatTimestamp}
                onSelect={openDescriptionDialog}
                t={t}
              />
            </div>
          </DataState>
        </TabsPanel>
      </Tabs>

      <CommentDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        comment={selectedComment}
        updateStatus={updateStatus}
        updateNote={updateNote}
        suspendDuration={suspendDuration}
        suspendExpiresAt={suspendExpiresAt}
        suspendReason={suspendReason}
        onUpdateStatus={handleUpdateStatus}
        onSuspendUser={handleSuspendUser}
        onStatusChange={setUpdateStatus}
        onNoteChange={setUpdateNote}
        onDurationChange={(value) => setSuspendDuration(value ?? "3d")}
        onExpiresChange={setSuspendExpiresAt}
        onReasonChange={setSuspendReason}
        formatTimestamp={formatTimestamp}
        t={t}
      />

      <DescriptionDetailDialog
        open={descriptionDialogOpen}
        onOpenChange={setDescriptionDialogOpen}
        description={selectedDescription}
        formatTimestamp={formatTimestamp}
        t={t}
      />
    </>
  );
}

function ModerationTableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/70 bg-card/72">
        <div className="p-4">
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="space-y-0 border-border/60 border-t">
          {stableSkeletonKeys(6, "moderation-row").map((key) => (
            <div
              key={key}
              className="flex items-center gap-4 border-border/60 border-b px-4 py-3 last:border-b-0"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// LiftSuspensionDialog removed with Suspensions tab.
