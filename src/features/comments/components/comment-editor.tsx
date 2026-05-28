"use client";

import { UploadCloud, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { SignInLink } from "@/components/sign-in-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { logClientError } from "@/lib/log/app-logger";
import { useCommentUpload } from "../hooks/use-comment-upload";
import type { CommentViewer } from "./comment-types";
import { MarkdownEditor } from "./markdown-editor";

type UploadOption = {
  id: string;
  filename: string;
  size: number;
  url?: string;
};

type UploadSummary = {
  maxFileSizeBytes: number;
  quotaBytes: number;
  usedBytes: number;
};

type CommentEditorProps = {
  viewer: CommentViewer;
  uploads: UploadOption[];
  onSubmit: (payload: {
    body: string;
    visibility: string;
    isAnonymous: boolean;
    attachmentIds: string[];
  }) => Promise<void>;
  uploadSummary?: UploadSummary | null;
  onUploadComplete?: (upload: UploadOption, summary: UploadSummary) => void;
  submitLabel: string;
  cancelLabel?: string;
  onCancel?: () => void;
  placeholder?: string;
  compact?: boolean;
  initialBody?: string;
  initialAttachments?: readonly string[];
  initialVisibility?: string;
  initialIsAnonymous?: boolean;
  targetOptions?: Array<{ value: string; label: string }>;
  targetValue?: string;
  onTargetChange?: (value: string) => void;
  hideVisibility?: boolean;
};

const EMPTY_ATTACHMENTS: readonly string[] = [];

export function CommentEditor({
  viewer,
  uploads: _uploads,
  onSubmit,
  uploadSummary,
  onUploadComplete,
  submitLabel,
  cancelLabel,
  onCancel,
  placeholder,
  compact,
  initialBody = "",
  initialAttachments = EMPTY_ATTACHMENTS,
  initialVisibility = "public",
  initialIsAnonymous = false,
  targetOptions,
  targetValue,
  onTargetChange,
  hideVisibility,
}: CommentEditorProps) {
  const t = useTranslations("comments");
  const tu = useTranslations("uploads");
  const { toast } = useToast();
  const [content, setContent] = useState(initialBody);
  const [visibility, setVisibility] = useState(
    initialVisibility === "anonymous" ? "public" : initialVisibility,
  );
  const [isAnonymous, setIsAnonymous] = useState(
    initialIsAnonymous || initialVisibility === "anonymous",
  );
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([
    ...initialAttachments,
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [targetDialogOpen, setTargetDialogOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingCursorPos, setPendingCursorPos] = useState<number | null>(null);

  useEffect(() => {
    if (pendingCursorPos === null) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.selectionStart = textarea.selectionEnd = pendingCursorPos;
    textarea.focus();
    setPendingCursorPos(null);
  }, [pendingCursorPos]);
  const anonymousId = useId();
  const loggedInId = useId();

  const { uploadFile, isUploading } = useCommentUpload({
    uploadSummary,
    onUploadComplete,
  });

  const insertMarkdown = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + text);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = content.substring(0, start);
    const after = content.substring(end);
    const newContent = before + text + after;
    setContent(newContent);
    setPendingCursorPos(start + text.length);
  };

  const handleUpload = async (file: File) => {
    // Use a unique token from the start to avoid collisions with same-name files
    const token = `![Uploading ${file.name}...](upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)})`;
    insertMarkdown(token);

    const uploaded = await uploadFile(file);

    if (uploaded) {
      setSelectedAttachments((prev) => [...prev, uploaded.id]);
      const isImage = file.type.startsWith("image/");
      const downloadUrl = `/api/uploads/${uploaded.id}/download`;
      const markdown = isImage
        ? `![${uploaded.filename}](${downloadUrl})`
        : `[${uploaded.filename}](${downloadUrl})`;

      setContent((prev) => prev.replace(token, markdown));
    } else {
      // Upload failed, remove placeholder
      setContent((prev) => prev.replace(token, ""));
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    setIsDragActive(false);

    if (!viewer.isAuthenticated || viewer.isSuspended) return;

    const files = event.dataTransfer.files;
    if (files.length === 0) return;

    void handleUpload(files[0]);
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({
        title: t("contentRequired"),
        description: t("contentRequiredDescription"),
        variant: "warning",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        body: content.trim(),
        visibility,
        isAnonymous,
        attachmentIds: selectedAttachments,
      });
      setContent("");
      setSelectedAttachments([]);
    } catch (error) {
      logClientError("Comment submit failed", error, {
        component: "CommentEditor",
        hasTargetSelector: Boolean(targetOptions?.length),
      });
      toast({
        title: t("submitFailed"),
        description: t("pleaseRetry"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentTarget = targetOptions?.find((opt) => opt.value === targetValue);
  const currentTargetLabel = currentTarget?.label;

  const getVisibilityDescription = () => {
    if (!currentTarget) return null;
    return t("commentTargetCurrent", { label: currentTargetLabel ?? "" });
  };

  return (
    <div className="space-y-4">
      {targetOptions && targetOptions.length > 1 && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            {getVisibilityDescription()}
          </span>

          <Dialog open={targetDialogOpen} onOpenChange={setTargetDialogOpen}>
            <DialogTrigger
              render={
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto p-0 text-primary"
                ></Button>
              }
            >
              {t("changeTarget")}
            </DialogTrigger>
            <DialogPopup>
              <DialogHeader>
                <DialogTitle>{t("changeTargetTitle")}</DialogTitle>
                <DialogDescription>
                  {t("changeTargetDescription")}
                </DialogDescription>
              </DialogHeader>
              <DialogPanel>
                <Select
                  value={targetValue}
                  onValueChange={(value) => {
                    if (value) {
                      onTargetChange?.(value);
                      setTargetDialogOpen(false);
                    }
                  }}
                  items={targetOptions}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("commentTargetPlaceholder")} />
                  </SelectTrigger>
                  <SelectPopup>
                    {targetOptions?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </DialogPanel>
              <DialogFooter>
                <DialogClose render={<Button variant="ghost" />}>
                  {t("cancelAction")}
                </DialogClose>
              </DialogFooter>
            </DialogPopup>
          </Dialog>
        </div>
      )}

      <div className="space-y-3">
        <MarkdownEditor
          value={content}
          onChange={setContent}
          placeholder={placeholder ?? t("editorPlaceholder")}
          tabWriteLabel={t("tabWrite")}
          tabPreviewLabel={t("tabPreview")}
          previewEmptyLabel={t("previewEmpty")}
          markdownGuideLabel={t("markdownGuide")}
          markdownGuideHref="/guides/markdown-support"
          disabled={!viewer.isAuthenticated || viewer.isSuspended}
          compact={compact}
          isDragActive={isDragActive}
          textareaRef={textareaRef}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
          onKeyDown={(event) => {
            if (
              (event.metaKey || event.ctrlKey) &&
              event.key === "Enter" &&
              viewer.isAuthenticated &&
              !viewer.isSuspended
            ) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
        />

        <Input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />
      </div>

      {selectedAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedAttachments.map((id) => {
            const upload = _uploads.find((u) => u.id === id);
            return (
              <Badge key={id} variant="secondary" className="gap-1 px-2 py-1">
                <span className="max-w-[150px] truncate text-[10px]">
                  {upload?.filename ?? id}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("removeAttachment")}
                  onClick={() =>
                    setSelectedAttachments((prev) =>
                      prev.filter((i) => i !== id),
                    )
                  }
                  className="h-5 w-5 rounded-full"
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          {!hideVisibility && (
            <div className="flex items-center gap-4">
              <label
                htmlFor={anonymousId}
                className="flex cursor-pointer select-none items-center gap-2"
              >
                <Checkbox
                  id={anonymousId}
                  checked={isAnonymous}
                  disabled={!viewer.isAuthenticated || viewer.isSuspended}
                  onCheckedChange={(checked) =>
                    setIsAnonymous(checked === true)
                  }
                />
                <span className="text-muted-foreground text-xs">
                  {t("visibilityAnonymous")}
                </span>
              </label>
              <label
                htmlFor={loggedInId}
                className="flex cursor-pointer select-none items-center gap-2"
              >
                <Checkbox
                  id={loggedInId}
                  checked={visibility === "logged_in_only"}
                  disabled={!viewer.isAuthenticated || viewer.isSuspended}
                  onCheckedChange={(checked) => {
                    if (checked) setVisibility("logged_in_only");
                    else setVisibility("public");
                  }}
                />
                <span className="text-muted-foreground text-xs">
                  {t("visibilityLoggedIn")}
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {onCancel && cancelLabel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-9 px-4 text-xs"
            >
              {cancelLabel}
            </Button>
          )}

          <Button
            variant="ghost"
            size="xs"
            className="h-9"
            onClick={() => fileInputRef.current?.click()}
            disabled={
              !viewer.isAuthenticated || viewer.isSuspended || isUploading
            }
          >
            <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
            <span className="text-xs">
              {isUploading ? tu("uploading") : tu("uploadAction")}
            </span>
          </Button>

          {!viewer.isAuthenticated ? (
            <Button
              variant="outline"
              size="sm"
              render={<SignInLink />}
              className="h-9 px-4 text-xs"
            >
              {t("loginToComment")}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                viewer.isSuspended ||
                isUploading ||
                !content.trim()
              }
              className="h-9 px-6 font-semibold text-xs"
            >
              {isSubmitting ? t("posting") : submitLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
