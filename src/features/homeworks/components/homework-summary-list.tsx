"use client";

import { CheckCircle2, LayoutGrid, List, Plus, RotateCcw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
  DashboardTabToolbar,
  DashboardTabToolbarGroup,
  dashboardTabToolbarItemClass,
} from "@/components/filters/dashboard-tab-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardPanel, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { CommentMarkdown } from "@/features/comments/components/comment-markdown";
import { CommentsSection } from "@/features/comments/components/comments-section";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/i18n/routing";
import { apiClient, extractApiErrorMessage } from "@/lib/api/client";
import { homeworkCompletionResponseSchema } from "@/lib/api/schemas/response-schemas";
import { logClientError } from "@/lib/log/app-logger";
import {
  formatDueRelativeTime,
  formatSmartDateTime,
} from "@/shared/lib/time-utils";
import { HomeworkCreateSheet } from "./homework-create-sheet";

type HomeworkSummary = {
  id: string;
  title: string;
  isMajor: boolean;
  requiresTeam: boolean;
  publishedAt: string | null;
  submissionStartAt: string | null;
  submissionDueAt: string | null;
  createdAt: string;
  description: string | null;
  completion: {
    completedAt: string;
  } | null;
  section: {
    jwId: number | null;
    code: string | null;
    courseName: string | null;
    semesterName: string | null;
  } | null;
};

type HomeworkSummaryListProps = {
  homeworks: HomeworkSummary[];
  sections: Array<{
    id: number;
    jwId: number | null;
    code: string | null;
    courseName: string | null;
    semesterName: string | null;
    semesterStart: string | null;
    semesterEnd: string | null;
  }>;
  referenceNow?: string | null;
};

type HomeworkFilter = "all" | "incomplete" | "completed";
type HomeworkViewMode = "cards" | "list";

const HOMEWORK_VIEW_MODE_PARAM = "homeworkView";
const HOMEWORK_VIEW_MODE_STORAGE_KEY = "life-ustc-dashboard-homework-view-mode";

function normalizeHomeworkViewMode(value: string | null): HomeworkViewMode {
  return value === "list" ? "list" : "cards";
}

function isHomeworkViewMode(value: string | null): value is HomeworkViewMode {
  return value === "cards" || value === "list";
}

export function HomeworkSummaryList({
  homeworks,
  sections,
  referenceNow,
}: HomeworkSummaryListProps) {
  const t = useTranslations("homeworks");
  const tComments = useTranslations("comments");
  const locale = useLocale();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState(homeworks);
  const [filter, setFilter] = useState<HomeworkFilter>("incomplete");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<HomeworkViewMode>(() =>
    normalizeHomeworkViewMode(searchParams.get(HOMEWORK_VIEW_MODE_PARAM)),
  );
  const [completionSaving, setCompletionSaving] = useState<
    Record<string, boolean>
  >({});
  useEffect(() => {
    setItems(homeworks);
  }, [homeworks]);

  useEffect(() => {
    const viewModeParam = searchParams.get(HOMEWORK_VIEW_MODE_PARAM);
    if (isHomeworkViewMode(viewModeParam)) {
      setViewMode(viewModeParam);
      window.localStorage.setItem(
        HOMEWORK_VIEW_MODE_STORAGE_KEY,
        viewModeParam,
      );
      return;
    }

    const cachedViewMode = window.localStorage.getItem(
      HOMEWORK_VIEW_MODE_STORAGE_KEY,
    );
    if (isHomeworkViewMode(cachedViewMode)) {
      setViewMode(cachedViewMode);
      return;
    }

    if (cachedViewMode !== null) {
      window.localStorage.removeItem(HOMEWORK_VIEW_MODE_STORAGE_KEY);
    }
    setViewMode("cards");
  }, [searchParams]);

  const referenceDate = useMemo(() => {
    if (!referenceNow) return new Date();
    const parsed = new Date(referenceNow);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [referenceNow]);

  const filteredItems = useMemo(() => {
    if (filter === "completed") {
      return items.filter((homework) => Boolean(homework.completion));
    }
    if (filter === "incomplete") {
      return items.filter((homework) => !homework.completion);
    }
    return items;
  }, [filter, items]);

  const formatDate = (value: string | null) => {
    if (!value) return t("dateTBD");
    return formatSmartDateTime(value, referenceDate, locale);
  };

  const renderTags = (homework: HomeworkSummary) => (
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
    setCompletionSaving((prev) => ({ ...prev, [homeworkId]: true }));
    try {
      const result = await apiClient.PUT("/api/homeworks/{id}/completion", {
        params: {
          path: { id: homeworkId },
        },
        body: { completed: nextCompleted },
      });

      if (!result.response.ok || !result.data) {
        const apiMessage = extractApiErrorMessage(result.error);
        logClientError(
          "Failed to update homework completion",
          apiMessage ?? result.error,
          {
            feature: "homeworks",
            homeworkId,
            nextCompleted,
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

      setItems((prev) =>
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
    } catch (error) {
      logClientError("Failed to update homework completion", error, {
        feature: "homeworks",
        homeworkId,
        nextCompleted,
      });
      toast({
        title: t("completionFailed"),
        variant: "destructive",
      });
    } finally {
      setCompletionSaving((prev) => ({ ...prev, [homeworkId]: false }));
    }
  };

  const handleViewModeChange = (mode: HomeworkViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(HOMEWORK_VIEW_MODE_STORAGE_KEY, mode);

    const nextParams = new URLSearchParams(searchParams.toString());
    if (mode === "cards") {
      nextParams.delete(HOMEWORK_VIEW_MODE_PARAM);
    } else {
      nextParams.set(HOMEWORK_VIEW_MODE_PARAM, mode);
    }
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  };

  const sectionOptions = useMemo(() => {
    return sections
      .filter((section) => typeof section.jwId === "number")
      .map((section) => {
        const parts = [section.code, section.courseName, section.semesterName]
          .map((value) => (value ?? "").trim())
          .filter(Boolean);
        return {
          id: section.id,
          label: parts.join(" · ") || String(section.id),
          semesterStart: section.semesterStart,
          semesterEnd: section.semesterEnd,
        };
      });
  }, [sections]);

  const renderCompletionButton = (
    homework: HomeworkSummary,
    className?: string,
  ) => (
    <Button
      size="xs"
      variant="outline"
      className={className}
      onClick={() =>
        void handleCompletionToggle(homework.id, !homework.completion)
      }
      disabled={completionSaving[homework.id]}
      aria-label={homework.completion ? t("markIncomplete") : t("markComplete")}
    >
      {homework.completion ? (
        <RotateCcw className="h-3.5 w-3.5" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5" />
      )}
      {homework.completion ? t("markIncomplete") : t("markComplete")}
    </Button>
  );

  const renderHomeworkDetails = (
    homework: HomeworkSummary,
    courseLabel: string,
    href: string,
    dueValue: string,
    dueRelative: string,
  ) => (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]">
      <div className="space-y-5">
        <div className="border-primary/35 border-l-2 py-1 pl-4">
          {homework.description ? (
            <CommentMarkdown content={homework.description} />
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
                {dueValue}
              </p>
            </div>
            {dueRelative ? (
              <p className="text-muted-foreground text-xs">{dueRelative}</p>
            ) : null}
          </div>
        </div>
        <div className="space-y-1.5 border-border/40 border-b pb-3 text-[11px] text-muted-foreground/64">
          <p className="leading-4">
            {t("submissionStart")} · {formatDate(homework.submissionStartAt)}
          </p>
          <p className="leading-4">
            {t("homeworkPublishedAt")} · {formatDate(homework.publishedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-border/60 border-t pt-1">
          {courseLabel ? (
            <Button
              size="xs"
              variant="ghost"
              render={
                <Link
                  className="text-muted-foreground no-underline hover:text-foreground"
                  href={href}
                />
              }
            >
              {courseLabel}
            </Button>
          ) : (
            <span className="min-w-0 flex-1" />
          )}
          {renderCompletionButton(homework)}
        </div>
      </div>
      <section className="min-w-0 space-y-3 border-border/60 border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
        <h3 className="font-medium text-sm">{t("commentsTitle")}</h3>
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

  return (
    <div className="space-y-4">
      <DashboardTabToolbar>
        <DashboardTabToolbarGroup>
          <Button
            size="sm"
            variant="ghost"
            className={dashboardTabToolbarItemClass(filter === "incomplete")}
            onClick={() => setFilter("incomplete")}
          >
            {t("filterIncomplete")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={dashboardTabToolbarItemClass(filter === "completed")}
            onClick={() => setFilter("completed")}
          >
            {t("filterCompleted")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={dashboardTabToolbarItemClass(filter === "all")}
            onClick={() => setFilter("all")}
          >
            {t("filterAll")}
          </Button>
        </DashboardTabToolbarGroup>
        <div className="flex flex-wrap items-center gap-2">
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
                onClick={() => handleViewModeChange(mode)}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </DashboardTabToolbarGroup>
          <HomeworkCreateSheet
            canCreate={sectionOptions.length > 0}
            t={t}
            tComments={tComments}
            sectionOptions={sectionOptions}
            defaultSectionId={sectionOptions[0]?.id ?? null}
            idPrefix="dashboard-homework"
            createButtonTestId="dashboard-homework-create"
            onCreated={() => {
              router.refresh();
            }}
            triggerRender={
              <Button
                disabled={sectionOptions.length === 0}
                data-testid="dashboard-homeworks-add"
              />
            }
            triggerChildren={
              <>
                <Plus className="h-4 w-4" />
                {t("addButton")}
              </>
            }
          />
        </div>
      </DashboardTabToolbar>

      {filteredItems.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("filterEmptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("filterEmptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {viewMode === "list" ? (
        <div
          className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card/72"
          data-testid="dashboard-homeworks-list"
        >
          {filteredItems.map((homework) => {
            const section = homework.section;
            const courseLabel = section?.courseName?.trim() || "";
            const href = section?.jwId
              ? `/sections/${section.jwId}#homework-${homework.id}`
              : "/sections";
            const isExpanded = expandedId === homework.id;
            const dueRelative = homework.submissionDueAt
              ? formatDueRelativeTime(
                  homework.submissionDueAt,
                  referenceDate,
                  locale,
                )
              : "";

            return (
              <div
                key={homework.id}
                className="group px-3 py-2.5 transition-colors hover:bg-background/90"
              >
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4">
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
                          className="grid min-w-0 gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
                          aria-expanded={isExpanded}
                        />
                      }
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate font-medium text-sm leading-5">
                          {homework.title}
                        </p>
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          {courseLabel ? (
                            <span className="truncate text-muted-foreground text-xs">
                              {courseLabel}
                            </span>
                          ) : null}
                          {renderTags(homework)}
                        </div>
                      </div>
                      <div className="text-xs sm:text-right">
                        <p className="font-semibold text-foreground tabular-nums">
                          {formatDate(homework.submissionDueAt)}
                        </p>
                        {dueRelative ? (
                          <p className="text-muted-foreground leading-4">
                            {dueRelative}
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
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          {courseLabel ? (
                            <span className="truncate text-muted-foreground text-xs">
                              {courseLabel}
                            </span>
                          ) : null}
                          {renderTags(homework)}
                        </div>
                      </DialogHeader>
                      <DialogPanel className="pt-5!">
                        {renderHomeworkDetails(
                          homework,
                          courseLabel,
                          href,
                          formatDate(homework.submissionDueAt),
                          dueRelative,
                        )}
                      </DialogPanel>
                    </DialogPopup>
                  </Dialog>
                  <div className="flex justify-start sm:justify-end">
                    {renderCompletionButton(homework)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
          data-testid="dashboard-homeworks-cards"
        >
          {filteredItems.map((homework) => {
            const section = homework.section;
            const courseLabel = section?.courseName?.trim() || "";
            const href = section?.jwId
              ? `/sections/${section.jwId}#homework-${homework.id}`
              : "/sections";
            const isExpanded = expandedId === homework.id;
            const dueRelative = homework.submissionDueAt
              ? formatDueRelativeTime(
                  homework.submissionDueAt,
                  referenceDate,
                  locale,
                )
              : "";

            return (
              <Card
                key={homework.id}
                className="group flex h-full min-h-0 flex-col rounded-xl border-border/70 bg-card/72"
              >
                <CardPanel className="flex min-h-0 flex-1 flex-col gap-3">
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
                          className="flex flex-1 flex-col gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          aria-expanded={isExpanded}
                        />
                      }
                    >
                      <div className="space-y-2">
                        <CardTitle className="min-w-0 truncate font-medium text-base">
                          {homework.title}
                        </CardTitle>
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          {courseLabel ? (
                            <span className="truncate text-muted-foreground text-xs">
                              {courseLabel}
                            </span>
                          ) : null}
                          {renderTags(homework)}
                        </div>
                      </div>
                      <div className="mt-auto text-sm">
                        <p className="font-semibold text-foreground tabular-nums">
                          {formatDate(homework.submissionDueAt)}
                        </p>
                        {dueRelative ? (
                          <p className="text-muted-foreground text-xs leading-4">
                            {dueRelative}
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
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          {courseLabel ? (
                            <span className="truncate text-muted-foreground text-xs">
                              {courseLabel}
                            </span>
                          ) : null}
                          {renderTags(homework)}
                        </div>
                      </DialogHeader>
                      <DialogPanel className="pt-5!">
                        {renderHomeworkDetails(
                          homework,
                          courseLabel,
                          href,
                          formatDate(homework.submissionDueAt),
                          dueRelative,
                        )}
                      </DialogPanel>
                    </DialogPopup>
                  </Dialog>
                  <div className="mt-auto flex justify-end">
                    <div>{renderCompletionButton(homework)}</div>
                  </div>
                </CardPanel>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
