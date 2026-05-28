"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { z } from "zod";
import { DataState } from "@/components/data-state";
import { SignInLink } from "@/components/sign-in-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Sheet,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CommentMarkdown } from "@/features/comments/components/comment-markdown";
import { MarkdownEditor } from "@/features/comments/components/markdown-editor";
import { useToast } from "@/hooks/use-toast";
import { apiClient, extractApiErrorMessage } from "@/lib/api/client";
import { descriptionsResponseSchema } from "@/lib/api/schemas/response-schemas";
import { logClientError } from "@/lib/log/app-logger";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";

type TargetType = "section" | "course" | "teacher" | "homework";

type DescriptionResponse = z.infer<typeof descriptionsResponseSchema>;
type DescriptionData = Omit<DescriptionResponse["description"], "updatedAt"> & {
  updatedAt: string | null;
};
type HistoryItem = DescriptionResponse["history"][number];
type ViewerSummary = DescriptionResponse["viewer"];
type DescriptionPanelData = Omit<DescriptionResponse, "description"> & {
  description: DescriptionData;
};

type DiffMode = "previous" | "next";

type DescriptionPanelProps = {
  targetType: TargetType;
  targetId: number | string;
  initialData?: DescriptionPanelData;
};

const EMPTY_DESCRIPTION: DescriptionData = {
  id: null,
  content: "",
  updatedAt: null,
  lastEditedAt: null,
  lastEditedBy: null,
};

const EMPTY_VIEWER: ViewerSummary = {
  userId: null,
  name: null,
  image: null,
  isAdmin: false,
  isAuthenticated: false,
  isSuspended: false,
  suspensionReason: null,
  suspensionExpiresAt: null,
};

type DiffSegment = {
  value: string;
  added?: boolean;
  removed?: boolean;
};

function DiffView({
  previous,
  next,
  mode,
}: {
  previous: string | null;
  next: string;
  mode: DiffMode;
}) {
  const [segments, setSegments] = useState<DiffSegment[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("diff").then((mod) => {
      if (cancelled) return;
      const result = mod.diffWords(previous ?? "", next);
      setSegments(result as DiffSegment[]);
    });
    return () => {
      cancelled = true;
    };
  }, [previous, next]);

  if (!segments) {
    return <span className="text-muted-foreground text-xs">...</span>;
  }

  const visibleSegments = segments.filter((segment) => {
    if (mode === "previous") return !segment.added;
    return !segment.removed;
  });

  if (visibleSegments.length === 0) {
    return null;
  }

  let segmentOffset = 0;

  return (
    <span className="whitespace-pre-wrap">
      {visibleSegments.map((segment) => {
        const isAdded = Boolean(segment.added);
        const isRemoved = Boolean(segment.removed);
        const highlightClass = isAdded
          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/20 dark:text-emerald-100"
          : isRemoved
            ? "bg-rose-100 text-rose-900 dark:bg-rose-400/20 dark:text-rose-100"
            : null;
        const segmentKey = `${mode}-${segmentOffset}-${segment.added ? "added" : "kept"}-${segment.removed ? "removed" : "visible"}`;
        segmentOffset += segment.value.length;

        return (
          <span key={segmentKey} className={highlightClass ?? undefined}>
            {segment.value}
          </span>
        );
      })}
    </span>
  );
}

export function DescriptionPanel({
  targetType,
  targetId,
  initialData,
}: DescriptionPanelProps) {
  const locale = useLocale();
  const t = useTranslations("descriptions");
  const { toast } = useToast();
  const [description, setDescription] = useState<DescriptionData>(
    initialData?.description ?? EMPTY_DESCRIPTION,
  );
  const [history, setHistory] = useState<HistoryItem[]>(
    initialData?.history ?? [],
  );
  const [viewer, setViewer] = useState<ViewerSummary>(
    initialData?.viewer ?? EMPTY_VIEWER,
  );
  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dateTimeFormatter = useMemo(
    () =>
      createShanghaiDateTimeFormatter(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const loadDescription = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data,
        error: errorBody,
        response,
      } = await apiClient.GET("/api/descriptions", {
        params: {
          query: {
            targetType,
            targetId: String(targetId),
          },
        },
      });

      if (!response.ok) {
        const apiMessage = extractApiErrorMessage(errorBody);
        throw new Error(apiMessage ?? "Failed to load description");
      }

      const parsedData = descriptionsResponseSchema.safeParse(data);
      if (!parsedData.success) {
        throw parsedData.error;
      }

      setDescription(parsedData.data.description ?? EMPTY_DESCRIPTION);
      setHistory(parsedData.data.history ?? []);
      setViewer(parsedData.data.viewer ?? EMPTY_VIEWER);
    } catch (err) {
      logClientError("Failed to load description", err, {
        component: "DescriptionPanel",
        targetType,
        targetId,
      });
      setError(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, targetId, targetType]);

  useEffect(() => {
    if (initialData) return;
    void loadDescription();
  }, [initialData, loadDescription]);

  const handleEdit = () => {
    setDraft(description.content);
    setEditing(true);
  };

  const handleCancel = () => {
    setDraft("");
    setEditing(false);
  };

  const handleSave = async () => {
    const content = draft.trim();
    setSaving(true);
    try {
      const { error: errorBody, response } = await apiClient.POST(
        "/api/descriptions",
        {
          body: {
            targetType,
            targetId,
            content,
          },
        },
      );

      if (!response.ok) {
        const apiMessage = extractApiErrorMessage(errorBody);
        throw new Error(apiMessage ?? "Failed to update description");
      }

      toast({
        title: t("updateSuccess"),
        variant: "success",
      });
      setEditing(false);
      setDraft("");
      await loadDescription();
    } catch (err) {
      logClientError("Failed to update description", err, {
        component: "DescriptionPanel",
        targetType,
        targetId,
      });
      toast({
        title: t("updateError"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const canEdit = viewer.isAuthenticated && !viewer.isSuspended;
  const lastEditedAt = description.lastEditedAt
    ? dateTimeFormatter.format(new Date(description.lastEditedAt))
    : null;
  const lastEditorName =
    description.lastEditedBy?.name ||
    description.lastEditedBy?.username ||
    t("editorUnknown");

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardAction>
          {viewer.isAuthenticated ? (
            canEdit && !editing ? (
              <Button size="sm" variant="outline" onClick={handleEdit}>
                {t("edit")}
              </Button>
            ) : null
          ) : (
            <Button
              size="sm"
              variant="outline"
              render={<SignInLink className="no-underline" />}
            >
              {t("loginToEdit")}
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardPanel className="space-y-5">
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
                <p className="font-semibold text-sm">
                  {t("suspendedPermanent")}
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {editing ? (
          <div className="space-y-3">
            <MarkdownEditor
              value={draft}
              onChange={setDraft}
              placeholder={t("editorPlaceholder")}
              tabWriteLabel={t("tabWrite")}
              tabPreviewLabel={t("tabPreview")}
              previewEmptyLabel={t("previewEmpty")}
              markdownGuideLabel={t("markdownGuide")}
              markdownGuideHref="/guides/markdown-support"
              disabled={!canEdit}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? t("saving") : t("save")}
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <DataState
            loading={loading}
            error={error}
            onRetry={() => void loadDescription()}
            retryLabel={t("retry")}
            empty={!description.content}
            emptyDescription={t("empty")}
            loadingFallback={
              <div className="space-y-3">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-20 w-full" />
              </div>
            }
          >
            <div className="space-y-2">
              <CommentMarkdown content={description.content} />
              {lastEditedAt && (
                <p className="text-muted-foreground text-xs">
                  {t("lastEdited", { date: lastEditedAt })} ·{" "}
                  {t("editedBy", { name: lastEditorName })}
                </p>
              )}
            </div>
          </DataState>
        )}

        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-muted-foreground text-sm"
              />
            }
          >
            {t("historyTitle", { count: history.length })}
          </SheetTrigger>
          <SheetPopup>
            <SheetHeader>
              <SheetTitle>
                {t("historyTitle", { count: history.length })}
              </SheetTitle>
            </SheetHeader>
            <SheetPanel>
              {history.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>{t("historyEmpty")}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="space-y-4">
                  {history.map((item) => {
                    const editorName =
                      item.editor?.name ||
                      item.editor?.username ||
                      t("editorUnknown");
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border/60 bg-muted/40 p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                          <span className="font-medium text-foreground">
                            {editorName}
                          </span>
                          <span>·</span>
                          <span>
                            {dateTimeFormatter.format(new Date(item.createdAt))}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <p className="mb-1 text-muted-foreground text-xs">
                              {t("previousLabel")}
                            </p>
                            <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border/60 bg-background p-2 text-xs">
                              <DiffView
                                previous={item.previousContent}
                                next={item.nextContent}
                                mode="previous"
                              />
                            </div>
                          </div>
                          <div>
                            <p className="mb-1 text-muted-foreground text-xs">
                              {t("updatedLabel")}
                            </p>
                            <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border/60 bg-background p-2 text-xs">
                              <DiffView
                                previous={item.previousContent}
                                next={item.nextContent}
                                mode="next"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SheetPanel>
          </SheetPopup>
        </Sheet>
      </CardPanel>
    </Card>
  );
}
