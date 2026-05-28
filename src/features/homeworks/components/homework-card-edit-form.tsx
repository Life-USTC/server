"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { CommentMarkdown } from "@/features/comments/components/comment-markdown";
import { MarkdownEditor } from "@/features/comments/components/markdown-editor";
import { apiClient, extractApiErrorMessage } from "@/lib/api/client";
import { descriptionsResponseSchema } from "@/lib/api/schemas/response-schemas";
import { logClientError } from "@/lib/log/app-logger";
import {
  addShanghaiTime,
  endOfShanghaiDay,
  startOfShanghaiDay,
  toShanghaiDateTimeLocalValue,
} from "@/lib/time/shanghai-format";
import type {
  DescriptionHistoryEntry,
  HomeworkCardEditFormProps,
} from "./homework-types";

export function HomeworkCardEditForm({
  homework,
  formatTimestamp,
  canDelete,
  semesterStartDate,
  semesterEndDate,
  onUpdate,
  onDelete,
  onCancel,
  t,
  tComments,
  tDescriptions,
}: HomeworkCardEditFormProps) {
  const [editTitle, setEditTitle] = useState(homework.title);
  const [editDescription, setEditDescription] = useState(
    homework.description?.content ?? "",
  );
  const [editPublishedAt, setEditPublishedAt] = useState(
    toShanghaiDateTimeLocalValue(homework.publishedAt),
  );
  const [editSubmissionStartAt, setEditSubmissionStartAt] = useState(
    toShanghaiDateTimeLocalValue(homework.submissionStartAt),
  );
  const [editSubmissionDueAt, setEditSubmissionDueAt] = useState(
    toShanghaiDateTimeLocalValue(homework.submissionDueAt),
  );
  const [editIsMajor, setEditIsMajor] = useState(homework.isMajor);
  const [editRequiresTeam, setEditRequiresTeam] = useState(
    homework.requiresTeam,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [descriptionHistory, setDescriptionHistory] = useState<{
    entries: DescriptionHistoryEntry[];
    loading: boolean;
    error: string | null;
  }>({ entries: [], loading: false, error: null });

  const currentDescription = homework.description?.content ?? "";

  const loadDescriptionHistory = async () => {
    setDescriptionHistory((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await apiClient.GET("/api/descriptions", {
        params: {
          query: {
            targetType: "homework",
            targetId: homework.id,
          },
        },
      });

      if (!result.response.ok || !result.data) {
        const apiMessage = extractApiErrorMessage(result.error);
        throw new Error(apiMessage ?? "Failed to load history");
      }

      const parsed = descriptionsResponseSchema.safeParse(result.data);
      if (!parsed.success) {
        throw new Error("Failed to load history");
      }

      setDescriptionHistory({
        entries: parsed.data.history ?? [],
        loading: false,
        error: null,
      });
    } catch (err) {
      logClientError("Failed to load description history", err, {
        component: "HomeworkCardEditForm",
        homeworkId: homework.id,
      });
      setDescriptionHistory((prev) => ({
        ...prev,
        loading: false,
        error: tDescriptions("historyError"),
      }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdate(
      homework.id,
      {
        title: editTitle,
        description: editDescription,
        publishedAt: editPublishedAt,
        submissionStartAt: editSubmissionStartAt,
        submissionDueAt: editSubmissionDueAt,
        isMajor: editIsMajor,
        requiresTeam: editRequiresTeam,
      },
      currentDescription,
    );
    setIsSaving(false);
  };

  const handleDelete = async () => {
    setIsSaving(true);
    await onDelete(homework.id);
    setIsSaving(false);
  };

  const applyStartNow = (setter: (value: string) => void) => {
    setter(toShanghaiDateTimeLocalValue(new Date()));
  };

  const applyDueInAWeek = (setter: (value: string) => void) => {
    setter(
      toShanghaiDateTimeLocalValue(
        endOfShanghaiDay(addShanghaiTime(new Date(), 7, "day")),
      ),
    );
  };

  const applySemesterEnd = (setter: (value: string) => void) => {
    if (!semesterEndDate || Number.isNaN(semesterEndDate.getTime())) return;
    setter(toShanghaiDateTimeLocalValue(endOfShanghaiDay(semesterEndDate)));
  };

  const applySemesterStart = (setter: (value: string) => void) => {
    if (!semesterStartDate || Number.isNaN(semesterStartDate.getTime())) return;
    setter(toShanghaiDateTimeLocalValue(startOfShanghaiDay(semesterStartDate)));
  };

  const renderHelperActions = (target: "start" | "due") => {
    const setValue =
      target === "start" ? setEditSubmissionStartAt : setEditSubmissionDueAt;

    return (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => applyStartNow(setValue)}
        >
          {t("helperNow")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => applyDueInAWeek(setValue)}
        >
          {t("helperWeek")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => applySemesterEnd(setValue)}
          disabled={!semesterEndDate}
        >
          {t("helperSemesterEnd")}
        </Button>
        {target === "start" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => applySemesterStart(setValue)}
            disabled={!semesterStartDate}
          >
            {t("helperSemesterStart")}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`homework-edit-title-${homework.id}`}>
          {t("titleLabel")}
        </Label>
        <Input
          id={`homework-edit-title-${homework.id}`}
          value={editTitle}
          onChange={(event) => setEditTitle(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("descriptionLabel")}</Label>
        <MarkdownEditor
          value={editDescription}
          onChange={setEditDescription}
          placeholder={t("descriptionPlaceholder")}
          tabWriteLabel={tComments("tabWrite")}
          tabPreviewLabel={tComments("tabPreview")}
          previewEmptyLabel={tComments("previewEmpty")}
          markdownGuideLabel={tComments("markdownGuide")}
          markdownGuideHref="/guides/markdown-support"
        />
      </div>

      <Separator />

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id={`homework-edit-major-${homework.id}`}
            checked={editIsMajor}
            onCheckedChange={setEditIsMajor}
          />
          <Label htmlFor={`homework-edit-major-${homework.id}`}>
            {t("tagMajor")}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id={`homework-edit-team-${homework.id}`}
            checked={editRequiresTeam}
            onCheckedChange={setEditRequiresTeam}
          />
          <Label htmlFor={`homework-edit-team-${homework.id}`}>
            {t("tagTeam")}
          </Label>
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`homework-edit-publish-${homework.id}`}>
            {t("publishedAt")}
          </Label>
          <Input
            id={`homework-edit-publish-${homework.id}`}
            type="datetime-local"
            value={editPublishedAt}
            onChange={(event) => setEditPublishedAt(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setEditPublishedAt(toShanghaiDateTimeLocalValue(new Date()))
              }
            >
              {t("helperPublishNow")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditPublishedAt("")}
            >
              {t("helperClear")}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`homework-edit-start-${homework.id}`}>
            {t("submissionStart")}
          </Label>
          <Input
            id={`homework-edit-start-${homework.id}`}
            type="datetime-local"
            value={editSubmissionStartAt}
            onChange={(event) => setEditSubmissionStartAt(event.target.value)}
          />
          {renderHelperActions("start")}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`homework-edit-due-${homework.id}`}>
            {t("submissionDue")}
          </Label>
          <Input
            id={`homework-edit-due-${homework.id}`}
            type="datetime-local"
            value={editSubmissionDueAt}
            onChange={(event) => setEditSubmissionDueAt(event.target.value)}
          />
          {renderHelperActions("due")}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Sheet
            onOpenChange={(open) => {
              if (open) {
                void loadDescriptionHistory();
              }
            }}
          >
            <SheetTrigger render={<Button size="sm" variant="outline" />}>
              {t("contentHistoryAction")}
            </SheetTrigger>
            <SheetPopup side="right">
              <SheetHeader>
                <SheetTitle>
                  {tDescriptions("historyTitle", {
                    count: descriptionHistory.entries?.length ?? 0,
                  })}
                </SheetTitle>
              </SheetHeader>
              <SheetPanel className="space-y-4">
                {descriptionHistory.loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : descriptionHistory.error ? (
                  <p className="text-muted-foreground text-sm">
                    {descriptionHistory.error}
                  </p>
                ) : descriptionHistory.entries?.length ? (
                  descriptionHistory.entries.map(
                    (entry: DescriptionHistoryEntry) => {
                      const editorName =
                        entry.editor?.name ||
                        entry.editor?.username ||
                        tDescriptions("editorUnknown");
                      return (
                        <div
                          key={entry.id}
                          className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-xs">
                            <span>{editorName}</span>
                            <span>{formatTimestamp(entry.createdAt)}</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <p className="text-muted-foreground text-xs">
                              {tDescriptions("previousLabel")}
                            </p>
                            <div className="rounded-md border border-border/60 bg-background px-3 py-2">
                              {entry.previousContent ? (
                                <CommentMarkdown
                                  content={entry.previousContent}
                                />
                              ) : (
                                <p className="text-muted-foreground text-sm">
                                  {tDescriptions("emptyValue")}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <p className="text-muted-foreground text-xs">
                              {tDescriptions("updatedLabel")}
                            </p>
                            <div className="rounded-md border border-border/60 bg-background px-3 py-2">
                              {entry.nextContent ? (
                                <CommentMarkdown content={entry.nextContent} />
                              ) : (
                                <p className="text-muted-foreground text-sm">
                                  {tDescriptions("emptyValue")}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    },
                  )
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {tDescriptions("historyEmpty")}
                  </p>
                )}
              </SheetPanel>
            </SheetPopup>
          </Sheet>
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger render={<Button size="sm" variant="ghost" />}>
                {t("deleteAction")}
              </AlertDialogTrigger>
              <AlertDialogPopup>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("deleteDescription", {
                      title: homework.title,
                    })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogClose render={<Button variant="ghost" />}>
                    {t("cancel")}
                  </AlertDialogClose>
                  <Button
                    variant="destructive"
                    onClick={() => void handleDelete()}
                    disabled={isSaving}
                  >
                    {t("confirmDelete")}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogPopup>
            </AlertDialog>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? t("saving") : t("saveChanges")}
          </Button>
        </div>
      </div>
    </div>
  );
}
