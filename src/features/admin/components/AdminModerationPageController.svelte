<script lang="ts">
import { toast } from "svelte-sonner";
import TableFilterFields from "#lib/components/TableFilterFields.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import AdminModerationDialogs from "@/features/admin/components/AdminModerationDialogs.svelte";
import AdminModerationFilters from "@/features/admin/components/AdminModerationFilters.svelte";
import AdminModerationHeader from "@/features/admin/components/AdminModerationHeader.svelte";
import AdminModerationStatusAlerts from "@/features/admin/components/AdminModerationStatusAlerts.svelte";
import AdminModerationTabContent from "@/features/admin/components/AdminModerationTabContent.svelte";
import AdminWorkspace from "@/features/admin/components/AdminWorkspace.svelte";
import type { AdminModerationComment } from "@/features/admin/components/admin-moderation-comment-types";
import type { AdminModerationDescription } from "@/features/admin/components/admin-moderation-description-types";
import type {
  AdminModerationAdminCopy,
  AdminModerationCopy,
  AdminModerationFilterKind,
  AdminModerationHomework,
  AdminModerationSuspension,
  AdminModerationTab,
} from "@/features/admin/components/admin-moderation-page-types";
import { createAdminModerationControllerDefaultState } from "@/features/admin/lib/admin-moderation-controller-default-state";
import { createModerationPageActions } from "@/features/admin/lib/moderation-page-actions";
import {
  buildCommentStatusOptions,
  buildSuspensionDurationOptions,
} from "@/features/admin/lib/moderation-page-options";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { tableFilterPageHref } from "@/lib/table-filter-query";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";
import { goto, invalidateAll } from "$app/navigation";
import { moderationTableFields } from "../lib/admin-moderation-table-fields";

type ModerationComment = AdminModerationComment;
type ModerationDescription = AdminModerationDescription;
type ModerationHomework = AdminModerationHomework;

type PageData = {
  comments: ModerationComment[];
  copy: {
    admin: AdminModerationAdminCopy;
    moderation: AdminModerationCopy;
  };
  descriptions: ModerationDescription[];
  filters: Record<string, string>;
  homeworks: ModerationHomework[];
  locale: string;
  suspensions: AdminModerationSuspension[];
  tab: AdminModerationTab;
};

type ActionData = Record<string, unknown> | null | undefined;

export let data: PageData;
export let form: ActionData;

let {
  _commentStatus,
  _customExpiresAt,
  _descriptionDraft,
  _dialogMessage,
  _dialogMessageVariant,
  _isRefreshingQueue,
  _isSavingComment,
  _isSuspendingUser,
  _moderationNote,
  _pendingDeleteHomework,
  _pendingServerAction,
  _refreshError,
  _selectedComment,
  _selectedDescription,
  _suspensionDuration,
  _suspensionReason,
} = createAdminModerationControllerDefaultState<
  ModerationComment,
  ModerationDescription,
  ModerationHomework
>({
  search: data.filters.search,
});

$: _copy = data.copy.moderation;
$: _adminCopy = data.copy.admin;
$: _dateTimeFormatter = createShanghaiDateTimeFormatter(data.locale, {
  dateStyle: "medium",
  timeStyle: "short",
});
$: _commentStatusOptions = buildCommentStatusOptions(_copy);
$: suspensionDurationOptions = buildSuspensionDurationOptions(_copy);

let draft: Record<string, string> = {};
$: draft = Object.fromEntries(
  Object.entries(data.filters).map(([key, value]) => [
    key,
    value === "all" ? "" : value,
  ]),
);
$: common = getWorkspacePageCopy(
  data.locale === "en-us" ? "en-us" : "zh-cn",
).common;
$: filterFields = moderationTableFields(data.tab, _copy, common.tableFilters);
function change(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}
function apply(event: SubmitEvent) {
  event.preventDefault();
  void goto(
    tableFilterPageHref("/admin/moderation", {
      ...draft,
      tab: data.tab,
      status: draft.status || "all",
      descriptionContent: draft.descriptionContent || "all",
      descriptionTarget: draft.descriptionTarget || "all",
    }),
  );
}

function inputValue(event: Event) {
  return (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
}

function _formatDate(value: string | Date) {
  return _dateTimeFormatter.format(new Date(value));
}

function _closeCommentDialog() {
  _selectedComment = null;
}

function _openDescriptionDialog(description: ModerationDescription) {
  _selectedDescription = description;
  _descriptionDraft = description.content ?? "";
}

function _closeDescriptionDialog() {
  _selectedDescription = null;
  _descriptionDraft = "";
}

const {
  enhanceAdminAction,
  openCommentDialog: _openCommentDialog,
  refreshQueue: _refreshQueue,
  saveCommentModeration: _saveCommentModeration,
  suspendCommentAuthor: _suspendCommentAuthor,
} = createModerationPageActions<ModerationComment>({
  closeCommentDialog: _closeCommentDialog,
  formatDate: _formatDate,
  getCommentStatus: () => _commentStatus,
  getCopy: () => _copy,
  getCustomExpiresAt: () => _customExpiresAt,
  getModerationNote: () => _moderationNote,
  getSelectedComment: () => _selectedComment,
  getSuspensionDuration: () => _suspensionDuration,
  getSuspensionReason: () => _suspensionReason,
  invalidateAll,
  onSuccess: (action) => {
    toast.success(
      action === "comment" ? _copy.commentUpdateSuccess : _copy.suspendSuccess,
    );
    _dialogMessage = "";
  },
  setCommentStatus: (value) => {
    _commentStatus = value;
  },
  setCustomExpiresAt: (value) => {
    _customExpiresAt = value;
  },
  setDialogMessage: (value) => {
    _dialogMessage = value;
  },
  setDialogMessageVariant: (value) => {
    _dialogMessageVariant = value;
  },
  setIsRefreshingQueue: (value) => {
    _isRefreshingQueue = value;
  },
  setIsSavingComment: (value) => {
    _isSavingComment = value;
  },
  setIsSuspendingUser: (value) => {
    _isSuspendingUser = value;
  },
  setModerationNote: (value) => {
    _moderationNote = value;
  },
  setPendingServerAction: (value) => {
    _pendingServerAction = value;
  },
  setRefreshError: (value) => {
    _refreshError = value;
  },
  setSelectedComment: (value) => {
    _selectedComment = value;
  },
  setSuspensionDuration: (value) => {
    _suspensionDuration = value;
  },
  setSuspensionReason: (value) => {
    _suspensionReason = value;
  },
});

function _enhanceAdminAction(action: Parameters<typeof enhanceAdminAction>[0]) {
  return enhanceAdminAction(action, () => {
    if (action.startsWith("liftSuspension:")) {
      toast.success(_copy.liftSuspensionSuccess);
    }
  });
}
</script>

<svelte:head><title>{_copy.title} - Life@USTC</title></svelte:head>

{#snippet filterControls(kind: AdminModerationFilterKind, viewport: "mobile" | "desktop")}
  <AdminModerationFilters
    fields={filterFields.fields[kind] ?? []}
    filters={draft}
    onchange={change}
    labels={common.tableFilters}
    searchPlaceholder={data.tab === "comments" ? _copy.searchPlaceholder : _copy.searchAllPlaceholder}
    {kind}
    {viewport}
  />
{/snippet}

<AdminWorkspace>
  {#snippet header()}
    <AdminModerationHeader
      adminCopy={_adminCopy}
      copy={_copy}
      isRefreshing={_isRefreshingQueue}
      refreshQueue={_refreshQueue}
    />
  {/snippet}
  {#snippet feedback()}
    <AdminModerationStatusAlerts {form} refreshError={_refreshError} />
  {/snippet}
  <form id="moderation-filters" onsubmit={apply} class="flex flex-wrap items-end gap-3">
    {#if filterFields.extras.length}<TableFilterFields fields={filterFields.extras} values={draft} onchange={change} labels={common.tableFilters} idPrefix="moderation-extra" formId="moderation-filters" />{/if}
    <Button type="submit">{common.applyFilters}</Button>
  </form>
  <AdminModerationTabContent
    {filterControls}
    copy={_copy}
    {data}
    enhanceAdminAction={_enhanceAdminAction}
    formatDate={_formatDate}
    liftingSuspensionId={_pendingServerAction?.startsWith("liftSuspension:")
      ? _pendingServerAction.slice("liftSuspension:".length)
      : null}
    onDeleteHomework={(homework) => {
      _pendingDeleteHomework = homework;
    }}
    onManageComment={(comment) => _openCommentDialog(comment as ModerationComment)}
    onManageDescription={(description) =>
      _openDescriptionDialog(description as ModerationDescription)}
    visibleComments={data.comments}
  />
</AdminWorkspace>

<AdminModerationDialogs
  closeCommentDialog={_closeCommentDialog}
  closeDescriptionDialog={_closeDescriptionDialog}
  bind:commentStatus={_commentStatus}
  commentStatusOptions={_commentStatusOptions}
  copy={_copy}
  bind:customExpiresAt={_customExpiresAt}
  bind:descriptionDraft={_descriptionDraft}
  dialogMessage={_dialogMessage}
  dialogMessageVariant={_dialogMessageVariant}
  deleteHomeworkAction={enhanceAdminAction("deleteHomework", () => {
    _pendingDeleteHomework = null;
    toast.success(_copy.deleteHomeworkSuccess);
  })}
  editDescriptionAction={enhanceAdminAction("description", () => {
    _closeDescriptionDialog();
    toast.success(_copy.descriptionUpdateSuccess);
  })}
  formatDate={_formatDate}
  {inputValue}
  isDeletingHomework={_pendingServerAction === "deleteHomework"}
  isSavingComment={_isSavingComment}
  isSavingDescription={_pendingServerAction === "description"}
  isSuspendingUser={_isSuspendingUser}
  bind:moderationNote={_moderationNote}
  pendingDeleteHomework={_pendingDeleteHomework}
  saveCommentModeration={_saveCommentModeration}
  selectedComment={_selectedComment}
  selectedDescription={_selectedDescription}
  setPendingDeleteHomework={(homework) => {
    _pendingDeleteHomework = homework;
  }}
  bind:suspensionDuration={_suspensionDuration}
  {suspensionDurationOptions}
  bind:suspensionReason={_suspensionReason}
  suspendCommentAuthor={_suspendCommentAuthor}
/>
