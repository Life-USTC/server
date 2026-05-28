"use client";

import { CheckCircle2, LayoutGrid, List, RotateCcw } from "lucide-react";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataState } from "@/components/data-state";
import {
  DashboardTabToolbarGroup,
  dashboardTabToolbarItemClass,
} from "@/components/filters/dashboard-tab-toolbar";
import { SignInLink } from "@/components/sign-in-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CommentMarkdown } from "@/features/comments/components/comment-markdown";
import { CommentsSection } from "@/features/comments/components/comments-section";
import { useToast } from "@/hooks/use-toast";
import { apiClient, extractApiErrorMessage } from "@/lib/api/client";
import {
  homeworkCompletionResponseSchema,
  homeworksListResponseSchema,
} from "@/lib/api/schemas/response-schemas";
import { logClientError } from "@/lib/log/app-logger";
import { toShanghaiIsoString } from "@/lib/time/serialize-date-output";
import {
  createShanghaiDateTimeFormatter,
  parseShanghaiDateTimeLocalInput,
} from "@/lib/time/shanghai-format";
import { formatDueRelativeTime } from "@/shared/lib/time-utils";
import {
  type HomeworkViewMode,
  useHomeworkViewMode,
} from "../hooks/use-homework-view-mode";
import { AuditLogSheet } from "./homework-audit-log-sheet";
import { HomeworkCardEditForm } from "./homework-card-edit-form";
import { HomeworkCreateSheet } from "./homework-create-sheet";
import { HomeworkItemCard } from "./homework-item-card";
import {
  type AuditLogEntry,
  EMPTY_VIEWER,
  type HomeworkEntry,
  type ViewerSummary,
} from "./homework-types";

const HOMEWORK_ERROR_KEY_MAP: Record<string, string> = {
  "Title required": "errorTitleRequired",
  "Title too long": "errorTitleTooLong",
  "Description too long": "errorDescriptionTooLong",
  "Invalid publish date": "errorInvalidPublishDate",
  "Invalid submission start": "errorInvalidSubmissionStart",
  "Invalid submission due": "errorInvalidSubmissionDue",
  "Submission start must be before due": "errorSubmissionRange",
  Unauthorized: "errorUnauthorized",
  Suspended: "errorSuspended",
  "Section not found": "errorSectionNotFound",
  "Not found": "errorNotFound",
  "Homework deleted": "errorHomeworkDeleted",
  "No changes": "errorNoChanges",
};

type HomeworkPanelProps = {
  sectionId: number;
  semesterStart?: string | null;
  semesterEnd?: string | null;
  initialData?: {
    homeworks: HomeworkEntry[];
    auditLogs: AuditLogEntry[];
    viewer: ViewerSummary;
  };
};

export function HomeworkPanel({
  sectionId,
  semesterStart,
  semesterEnd,
  initialData,
}: HomeworkPanelProps) {
  const locale = useLocale();
  const t = useTranslations("homeworks");
  const tComments = useTranslations("comments");
  const tDescriptions = useTranslations("descriptions");
  const { toast } = useToast();
  const { viewMode, changeViewMode } = useHomeworkViewMode();
  const [homeworks, setHomeworks] = useState<HomeworkEntry[]>(
    initialData?.homeworks ?? [],
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(
    initialData?.auditLogs ?? [],
  );
  const [viewer, setViewer] = useState<ViewerSummary>(
    initialData?.viewer ?? EMPTY_VIEWER,
  );
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completionSaving, setCompletionSaving] = useState<
    Record<string, boolean>
  >({});
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

  const semesterEndDate = useMemo(
    () => (semesterEnd ? new Date(semesterEnd) : null),
    [semesterEnd],
  );
  const semesterStartDate = useMemo(
    () => (semesterStart ? new Date(semesterStart) : null),
    [semesterStart],
  );

  const canCreate = viewer.isAuthenticated && !viewer.isSuspended;
  const canEdit = viewer.isAuthenticated && !viewer.isSuspended;
  const resolveHomeworkError = useCallback(
    (error: string | null) => {
      if (!error) return t("errorGeneric");
      const key = HOMEWORK_ERROR_KEY_MAP[error];
      return key ? t(key) : t("errorGeneric");
    },
    [t],
  );

  const resolveApiErrorMessage = useCallback(
    (errorBody: unknown) =>
      resolveHomeworkError(extractApiErrorMessage(errorBody)),
    [resolveHomeworkError],
  );

  const loadHomeworks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.GET("/api/homeworks", {
        params: {
          query: { sectionId: String(sectionId) },
        },
      });

      if (!result.response.ok || !result.data) {
        const apiMessage = extractApiErrorMessage(result.error);
        throw new Error(apiMessage ?? "Failed to load homeworks");
      }

      const parsed = homeworksListResponseSchema.safeParse(result.data);
      if (!parsed.success) {
        throw new Error("Failed to load homeworks");
      }

      setHomeworks(parsed.data.homeworks ?? []);
      setAuditLogs(parsed.data.auditLogs ?? []);
      setViewer(parsed.data.viewer ?? EMPTY_VIEWER);
    } catch (err) {
      logClientError("Failed to load homeworks", err, {
        component: "HomeworkPanel",
        sectionId,
      });
      setError(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [sectionId, t]);

  useEffect(() => {
    if (initialData) return;
    void loadHomeworks();
  }, [initialData, loadHomeworks]);

  const renderTagBadges = (homework: HomeworkEntry) => (
    <div className="flex flex-wrap gap-2">
      {homework.completion && (
        <Badge variant="success">{t("completedLabel")}</Badge>
      )}
      {homework.isMajor && <Badge variant="secondary">{t("tagMajor")}</Badge>}
      {homework.requiresTeam && <Badge variant="outline">{t("tagTeam")}</Badge>}
    </div>
  );

  const handleCompletionToggle = async (
    homeworkId: string,
    nextCompleted: boolean,
  ) => {
    if (!viewer.isAuthenticated) return;
    setCompletionSaving((prev) => ({ ...prev, [homeworkId]: true }));
    try {
      const result = await apiClient.PUT("/api/homeworks/{id}/completion", {
        params: {
          path: { id: homeworkId },
        },
        body: {
          completed: nextCompleted,
        },
      });

      if (!result.response.ok || !result.data) {
        const apiMessage = extractApiErrorMessage(result.error);
        logClientError(
          "Failed to update completion",
          apiMessage ?? result.error,
          {
            component: "HomeworkPanel",
            sectionId,
            homeworkId,
          },
        );
        toast({
          title: t("completionFailed"),
          variant: "destructive",
        });
        return;
      }

      const parsed = homeworkCompletionResponseSchema.safeParse(result.data);
      if (!parsed.success) {
        toast({
          title: t("completionFailed"),
          variant: "destructive",
        });
        return;
      }

      setHomeworks((prev) =>
        prev.map((homework) =>
          homework.id === homeworkId
            ? {
                ...homework,
                completion:
                  parsed.data.completed && parsed.data.completedAt
                    ? { completedAt: parsed.data.completedAt }
                    : null,
              }
            : homework,
        ),
      );
    } catch (err) {
      logClientError("Failed to update completion", err, {
        component: "HomeworkPanel",
        sectionId,
        homeworkId,
      });
      toast({
        title: t("completionFailed"),
        variant: "destructive",
      });
    } finally {
      setCompletionSaving((prev) => ({ ...prev, [homeworkId]: false }));
    }
  };

  const renderHomeworkActions = (homework: HomeworkEntry) =>
    canEdit ? (
      <Button
        size="sm"
        variant="outline"
        onClick={() => setEditingId(homework.id)}
      >
        {t("editAction")}
      </Button>
    ) : null;

  const renderCompletionButton = (
    homework: HomeworkEntry,
    className?: string,
  ) =>
    viewer.isAuthenticated ? (
      <Button
        size="xs"
        variant="outline"
        className={className}
        onClick={() =>
          void handleCompletionToggle(homework.id, !homework.completion)
        }
        disabled={Boolean(completionSaving[homework.id])}
        aria-label={
          homework.completion ? t("markIncomplete") : t("markComplete")
        }
      >
        {homework.completion ? (
          <RotateCcw className="h-3.5 w-3.5" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        {homework.completion ? t("markIncomplete") : t("markComplete")}
      </Button>
    ) : null;

  const renderHomeworkDetailCard = (
    homework: HomeworkEntry,
    submissionDueValue: string,
    submissionDueRelativeLabel?: string,
  ) => (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]">
      <div className="space-y-5">
        <div className="border-primary/35 border-l-2 py-1 pl-4">
          {homework.description?.content ? (
            <CommentMarkdown content={homework.description.content} />
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("descriptionEmpty")}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-xs">
                {t("submissionDue")}
              </p>
              <p className="font-semibold text-foreground text-xl tabular-nums leading-7">
                {submissionDueValue}
              </p>
            </div>
            {submissionDueRelativeLabel ? (
              <p className="text-muted-foreground text-xs">
                {submissionDueRelativeLabel}
              </p>
            ) : null}
          </div>
        </div>
        <div className="space-y-1.5 border-border/40 border-b pb-3 text-[11px] text-muted-foreground/64">
          <p className="leading-4">
            {t("submissionStart")} ·{" "}
            {homework.submissionStartAt
              ? formatTimestamp(homework.submissionStartAt)
              : t("dateTBD")}
          </p>
          <p className="leading-4">
            {t("homeworkPublishedAt")} ·{" "}
            {homework.publishedAt
              ? formatTimestamp(homework.publishedAt)
              : t("dateTBD")}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-border/60 border-t pt-1">
          {renderHomeworkActions(homework)}
          {renderCompletionButton(homework)}
        </div>
      </div>
      <section className="min-w-0 space-y-3 border-border/60 border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-sm">{t("commentsTitle")}</h3>
          <span className="text-muted-foreground text-xs">
            {t("commentsAction")} ({homework.commentCount})
          </span>
        </div>
        <CommentsSection
          targets={[
            {
              key: "homework",
              label: t("commentsLabel"),
              type: "homework",
              homeworkId: homework.id,
            },
          ]}
        />
      </section>
    </div>
  );

  const renderEditCard = (homework: HomeworkEntry, createdAtLabel: string) => {
    const canDelete =
      viewer.isAuthenticated &&
      !viewer.isSuspended &&
      (viewer.isAdmin || homework.createdById === viewer.userId);

    return (
      <Card key={homework.id} className="border-border/60">
        <CardHeader className="gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{homework.title}</CardTitle>
            <p className="text-muted-foreground text-xs">{createdAtLabel}</p>
          </div>
        </CardHeader>
        <CardPanel className="space-y-4">
          <HomeworkCardEditForm
            homework={homework}
            formatTimestamp={formatTimestamp}
            canDelete={canDelete}
            semesterStartDate={semesterStartDate}
            semesterEndDate={semesterEndDate}
            onUpdate={async (homeworkId, data, currentDescription) => {
              if (!data.title.trim()) {
                toast({
                  title: t("titleRequired"),
                  variant: "destructive",
                });
                return false;
              }

              try {
                const publishedAtDate = parseShanghaiDateTimeLocalInput(
                  data.publishedAt,
                );
                const submissionStartAtDate = parseShanghaiDateTimeLocalInput(
                  data.submissionStartAt,
                );
                const submissionDueAtDate = parseShanghaiDateTimeLocalInput(
                  data.submissionDueAt,
                );
                if (
                  publishedAtDate === undefined ||
                  submissionStartAtDate === undefined ||
                  submissionDueAtDate === undefined
                ) {
                  toast({
                    title: t("updateFailed"),
                    description: t("errorInvalidSubmissionDue"),
                    variant: "destructive",
                  });
                  return false;
                }

                const updateResult = await apiClient.PATCH(
                  "/api/homeworks/{id}",
                  {
                    params: {
                      path: { id: homeworkId },
                    },
                    body: {
                      title: data.title.trim(),
                      publishedAt: publishedAtDate
                        ? toShanghaiIsoString(publishedAtDate)
                        : null,
                      submissionStartAt: submissionStartAtDate
                        ? toShanghaiIsoString(submissionStartAtDate)
                        : null,
                      submissionDueAt: submissionDueAtDate
                        ? toShanghaiIsoString(submissionDueAtDate)
                        : null,
                      isMajor: data.isMajor,
                      requiresTeam: data.requiresTeam,
                    },
                  },
                );

                if (!updateResult.response.ok) {
                  const message = resolveApiErrorMessage(updateResult.error);
                  toast({
                    title: t("updateFailed"),
                    description: message,
                    variant: "destructive",
                  });
                  return false;
                }

                const nextDescription = data.description.trim();
                if (nextDescription !== currentDescription) {
                  const descriptionResult = await apiClient.POST(
                    "/api/descriptions",
                    {
                      body: {
                        targetType: "homework",
                        targetId: homeworkId,
                        content: nextDescription,
                      },
                    },
                  );

                  if (!descriptionResult.response.ok) {
                    const message = resolveApiErrorMessage(
                      descriptionResult.error,
                    );
                    toast({
                      title: t("updateFailed"),
                      description: message,
                      variant: "destructive",
                    });
                    return false;
                  }
                }

                toast({
                  title: t("updateSuccess"),
                  variant: "success",
                });
                setEditingId(null);
                await loadHomeworks();
                return true;
              } catch (err) {
                logClientError("Failed to update homework", err, {
                  component: "HomeworkPanel",
                  sectionId,
                  homeworkId: homework.id,
                });
                toast({
                  title: t("updateFailed"),
                  variant: "destructive",
                });
                return false;
              }
            }}
            onDelete={async (homeworkId) => {
              try {
                const deleteResult = await apiClient.DELETE(
                  "/api/homeworks/{id}",
                  {
                    params: {
                      path: { id: homeworkId },
                    },
                  },
                );

                if (!deleteResult.response.ok) {
                  const message = resolveApiErrorMessage(deleteResult.error);
                  toast({
                    title: t("deleteFailed"),
                    description: message,
                    variant: "destructive",
                  });
                  return false;
                }

                toast({
                  title: t("deleteSuccess"),
                  variant: "success",
                });
                setEditingId(null);
                await loadHomeworks();
                return true;
              } catch (err) {
                logClientError("Failed to delete homework", err, {
                  component: "HomeworkPanel",
                  sectionId,
                  homeworkId: homework.id,
                });
                toast({
                  title: t("deleteFailed"),
                  variant: "destructive",
                });
                return false;
              }
            }}
            onCancel={() => setEditingId(null)}
            t={t}
            tComments={tComments}
            tDescriptions={tDescriptions}
          />
        </CardPanel>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DashboardTabToolbarGroup aria-label={t("viewMode")}>
          {(
            [
              {
                mode: "cards" as const,
                label: t("cardView"),
                icon: LayoutGrid,
              },
              {
                mode: "list" as const,
                label: t("listView"),
                icon: List,
              },
            ] satisfies {
              mode: HomeworkViewMode;
              label: string;
              icon: typeof LayoutGrid;
            }[]
          ).map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              className={dashboardTabToolbarItemClass(
                viewMode === mode,
                "inline-flex items-center gap-2",
              )}
              aria-pressed={viewMode === mode}
              title={label}
              onClick={() => changeViewMode(mode)}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </DashboardTabToolbarGroup>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canCreate ? (
            <HomeworkCreateSheet
              canCreate={canCreate}
              t={t}
              tComments={tComments}
              fixedSectionId={sectionId}
              fixedSemesterEnd={semesterEnd}
              idPrefix="section-homework"
              onCreated={loadHomeworks}
              triggerRender={<Button size="sm" variant="outline" />}
              triggerChildren={t("showCreate")}
            />
          ) : (
            <Button
              size="sm"
              variant="outline"
              render={<SignInLink className="no-underline" />}
            >
              {t("loginToCreate")}
            </Button>
          )}
          <AuditLogSheet
            auditLogs={auditLogs}
            formatTimestamp={formatTimestamp}
            labels={{
              title: t("auditTitle"),
              empty: t("auditEmpty"),
              created: t("auditCreated"),
              deleted: t("auditDeleted"),
              meta: ({ name, date }: { name: string; date: string }) =>
                t("auditMeta", { name, date }),
              trigger: t("auditTitle"),
            }}
          />
        </div>
      </div>

      {viewer.isSuspended && (
        <Card className="border-dashed bg-muted/40">
          <CardPanel className="space-y-2">
            <p className="text-muted-foreground text-sm">{t("suspended")}</p>
            {viewer.suspensionReason && (
              <p className="text-muted-foreground text-xs">
                {t("suspendedReason", { reason: viewer.suspensionReason })}
              </p>
            )}
          </CardPanel>
        </Card>
      )}

      <DataState
        loading={loading}
        error={error}
        onRetry={() => void loadHomeworks()}
        retryLabel={t("retry")}
        empty={homeworks.length === 0}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
        loadingFallback={
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        }
      >
        <div
          className={
            viewMode === "list"
              ? "divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card/72"
              : "grid gap-3 md:grid-cols-2 xl:grid-cols-3"
          }
          data-testid={
            viewMode === "list"
              ? "section-homeworks-list"
              : "section-homeworks-cards"
          }
        >
          {homeworks.map((homework) => {
            const isEditing = editingId === homework.id;
            const isExpanded = expandedId === homework.id;
            const createdAtLabel = t("createdAt", {
              date: formatTimestamp(homework.createdAt),
            });
            const submissionDueValue = homework.submissionDueAt
              ? formatTimestamp(homework.submissionDueAt)
              : t("dateTBD");
            const submissionDueRelativeLabel = homework.submissionDueAt
              ? formatDueRelativeTime(
                  homework.submissionDueAt,
                  new Date(),
                  locale,
                )
              : undefined;

            if (isEditing) {
              return viewMode === "list" ? (
                <div key={homework.id} className="bg-background/40 p-3">
                  {renderEditCard(homework, createdAtLabel)}
                </div>
              ) : (
                <div key={homework.id} className="md:col-span-2 xl:col-span-3">
                  {renderEditCard(homework, createdAtLabel)}
                </div>
              );
            }

            if (viewMode === "list") {
              return (
                <div
                  key={homework.id}
                  id={`homework-${homework.id}`}
                  className="group px-3 py-2.5 transition-colors hover:bg-background/90"
                >
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:gap-4">
                    <Dialog
                      open={isExpanded}
                      onOpenChange={(open) =>
                        setExpandedId(open ? homework.id : null)
                      }
                    >
                      <DialogTrigger
                        render={
                          <button
                            type="button"
                            className="grid min-w-0 gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:col-span-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-4"
                            aria-expanded={isExpanded}
                          />
                        }
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="truncate font-medium text-sm leading-5">
                            {homework.title}
                          </p>
                          {renderTagBadges(homework)}
                        </div>
                        <div className="text-xs md:text-right">
                          <p className="font-semibold text-foreground tabular-nums">
                            {submissionDueValue}
                          </p>
                          {submissionDueRelativeLabel ? (
                            <p className="text-muted-foreground leading-4">
                              {submissionDueRelativeLabel}
                            </p>
                          ) : null}
                        </div>
                      </DialogTrigger>
                      <DialogPopup
                        className="max-w-5xl"
                        bottomStickOnMobile={false}
                      >
                        <DialogHeader className="gap-3 border-border/60 border-b bg-muted/18 pb-4">
                          <DialogTitle className="pr-8 text-[1.35rem] leading-7">
                            {homework.title}
                          </DialogTitle>
                          {renderTagBadges(homework)}
                        </DialogHeader>
                        <DialogPanel className="pt-5!">
                          {renderHomeworkDetailCard(
                            homework,
                            submissionDueValue,
                            submissionDueRelativeLabel,
                          )}
                        </DialogPanel>
                      </DialogPopup>
                    </Dialog>
                    <div className="flex justify-start md:justify-end">
                      {renderCompletionButton(homework)}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <HomeworkItemCard
                key={homework.id}
                cardId={`homework-${homework.id}`}
                cardClassName="group"
                title={homework.title}
                expanded={isExpanded}
                onOpenChange={(open) =>
                  setExpandedId(open ? homework.id : null)
                }
                headerActions={
                  canEdit ? (
                    <div className="flex flex-wrap gap-2">
                      {renderHomeworkActions(homework)}
                    </div>
                  ) : undefined
                }
                submissionDueLabel={t("submissionDue")}
                submissionDueValue={submissionDueValue}
                submissionDueRelativeLabel={submissionDueRelativeLabel}
                description={homework.description?.content ?? null}
                descriptionEmptyLabel={t("descriptionEmpty")}
                startAtLabel={t("submissionStart")}
                startAtValue={
                  homework.submissionStartAt
                    ? formatTimestamp(homework.submissionStartAt)
                    : t("dateTBD")
                }
                publishedAtLabel={t("homeworkPublishedAt")}
                publishedAtValue={
                  homework.publishedAt
                    ? formatTimestamp(homework.publishedAt)
                    : t("dateTBD")
                }
                detailAfter={
                  <section className="space-y-3 border-border/60 border-t pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-medium text-sm">
                        {t("commentsTitle")}
                      </h3>
                      <span className="text-muted-foreground text-xs">
                        {t("commentsAction")} ({homework.commentCount})
                      </span>
                    </div>
                    <CommentsSection
                      targets={[
                        {
                          key: "homework",
                          label: t("commentsLabel"),
                          type: "homework",
                          homeworkId: homework.id,
                        },
                      ]}
                    />
                  </section>
                }
                footerStart={renderTagBadges(homework)}
                footerEnd={
                  <div className="min-h-7">
                    {renderCompletionButton(homework)}
                  </div>
                }
              />
            );
          })}
        </div>
      </DataState>
    </div>
  );
}

// NOTE: HomeworkCardEditForm and AuditLogSheet have been extracted to
// ./homework-card-edit-form.tsx and ./homework-audit-log-sheet.tsx respectively.
// Types are shared via ./homework-types.ts.
