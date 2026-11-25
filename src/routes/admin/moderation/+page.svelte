<script lang="ts">
import { toast } from "@ui-sdk/svelte/toast";
import TableFilterFields from "#lib/components/TableFilterFields.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import AdminModerationCommentDialog from "@/features/admin/components/AdminModerationCommentDialog.svelte";
import AdminModerationComments from "@/features/admin/components/AdminModerationComments.svelte";
import AdminModerationDeleteHomeworkDialog from "@/features/admin/components/AdminModerationDeleteHomeworkDialog.svelte";
import AdminModerationDescriptionDialog from "@/features/admin/components/AdminModerationDescriptionDialog.svelte";
import AdminModerationDescriptions from "@/features/admin/components/AdminModerationDescriptions.svelte";
import AdminModerationFilters from "@/features/admin/components/AdminModerationFilters.svelte";
import AdminModerationHeader from "@/features/admin/components/AdminModerationHeader.svelte";
import AdminModerationHomeworks from "@/features/admin/components/AdminModerationHomeworks.svelte";
import AdminModerationStatusAlerts from "@/features/admin/components/AdminModerationStatusAlerts.svelte";
import AdminModerationSuspensions from "@/features/admin/components/AdminModerationSuspensions.svelte";
import AdminWorkspace from "@/features/admin/components/AdminWorkspace.svelte";
import type { AdminModerationComment } from "@/features/admin/components/admin-moderation-comment-types";
import type { AdminModerationDescription } from "@/features/admin/components/admin-moderation-description-types";
import type {
  AdminModerationFilterKind,
  AdminModerationHomework,
  AdminModerationTab,
} from "@/features/admin/components/admin-moderation-page-types";
import { moderationTableFields } from "@/features/admin/lib/admin-moderation-table-fields";
import {
  moderationCommentAuthorLabel,
  moderationDescriptionEditedAt,
  moderationDescriptionTargetHref,
  moderationFormatMessage,
  moderationStatusLabel,
  moderationTargetHref,
  moderationTargetLabel,
} from "@/features/admin/lib/moderation-display";
import { createModerationPageActions } from "@/features/admin/lib/moderation-page-actions";
import type { PendingModerationServerAction } from "@/features/admin/lib/moderation-page-client-actions";
import {
  buildCommentStatusOptions,
  buildSuspensionDurationOptions,
} from "@/features/admin/lib/moderation-page-options";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { tableFilterPageHref } from "@/lib/table-filter-query";
import { campusTimestampFormatter } from "@/lib/time/shanghai-format";
import { goto, invalidateAll } from "$app/navigation";

import type { ActionData, PageData } from "./$types";

export let data: PageData;
export let form: ActionData;

let _commentStatus: "active" | "softbanned" | "deleted" = "active";
let _customExpiresAt = "";
let _descriptionDraft = "";
let _dialogMessage = "";
let _dialogMessageVariant: "default" | "destructive" = "default";
let _isRefreshingQueue = false;
let _isSavingComment = false;
let _isSuspendingUser = false;
let _moderationNote = "";
let _pendingDeleteHomework: AdminModerationHomework | null = null;
let _pendingServerAction: PendingModerationServerAction | null = null;
let _refreshError = "";
let _selectedComment: AdminModerationComment | null = null;
let _selectedDescription: AdminModerationDescription | null = null;
let _suspensionDuration = "7d";
let _suspensionReason = "";

$: _copy = data.copy.moderation;
$: _adminCopy = data.copy.admin;
$: _dateTimeFormatter = campusTimestampFormatter(data.locale);
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

function _openDescriptionDialog(description: AdminModerationDescription) {
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
} = createModerationPageActions<AdminModerationComment>({
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
  {#if data.tab === "descriptions"}
    <AdminModerationDescriptions
      {filterControls}
      copy={_copy}
      descriptions={data.descriptions}
      descriptionTargetHref={moderationDescriptionTargetHref}
      formatDate={_formatDate}
      formatMessage={moderationFormatMessage}
      onManage={_openDescriptionDialog}
      targetLabel={(item) => moderationTargetLabel(item, _copy)}
    />
  {:else if data.tab === "homeworks"}
    <AdminModerationHomeworks
      {filterControls}
      copy={_copy}
      formatDate={_formatDate}
      homeworks={data.homeworks}
      onDelete={(homework) => { _pendingDeleteHomework = homework; }}
    />
  {:else if data.tab === "suspensions"}
    <AdminModerationSuspensions
      {filterControls}
      copy={_copy}
      enhanceLiftSuspension={(id) => _enhanceAdminAction(`liftSuspension:${id}`)}
      formatDate={_formatDate}
      formatMessage={moderationFormatMessage}
      liftingSuspensionId={_pendingServerAction?.startsWith("liftSuspension:") ? _pendingServerAction.slice("liftSuspension:".length) : null}
      suspensions={data.suspensions}
    />
  {:else}
    <AdminModerationComments
      {filterControls}
      commentAuthorLabel={(comment) =>
        moderationCommentAuthorLabel(comment as AdminModerationComment, _copy.guestLabel)}
      comments={data.comments}
      copy={_copy}
      formatDate={_formatDate}
      onManage={_openCommentDialog}
      statusLabel={(status) => moderationStatusLabel(status, _copy)}
      targetHref={moderationTargetHref}
      targetLabel={(item) => moderationTargetLabel(item, _copy)}
    />
  {/if}
</AdminWorkspace>

<AdminModerationCommentDialog
  bind:commentStatus={_commentStatus}
  bind:customExpiresAt={_customExpiresAt}
  bind:moderationNote={_moderationNote}
  bind:suspensionDuration={_suspensionDuration}
  bind:suspensionReason={_suspensionReason}
  close={_closeCommentDialog}
  comment={_selectedComment}
  commentAuthorLabel={(comment) => moderationCommentAuthorLabel(comment, _copy.guestLabel)}
  commentStatusOptions={_commentStatusOptions}
  copy={_copy}
  dialogMessage={_dialogMessage}
  dialogMessageVariant={_dialogMessageVariant}
  inputValue={inputValue}
  isSavingComment={_isSavingComment}
  isSuspendingUser={_isSuspendingUser}
  saveCommentModeration={_saveCommentModeration}
  suspendCommentAuthor={_suspendCommentAuthor}
  suspensionDurationOptions={suspensionDurationOptions}
  targetHref={moderationTargetHref}
  targetLabel={(item) => moderationTargetLabel(item, _copy)}
/>

<AdminModerationDeleteHomeworkDialog
  close={() => {
    _pendingDeleteHomework = null;
  }}
  copy={_copy}
  enhanceDeleteHomework={enhanceAdminAction("deleteHomework", () => {
    _pendingDeleteHomework = null;
    toast.success(_copy.deleteHomeworkSuccess);
  })}
  formatMessage={moderationFormatMessage}
  homework={_pendingDeleteHomework}
  isDeleting={_pendingServerAction === "deleteHomework"}
/>

<AdminModerationDescriptionDialog
  bind:descriptionDraft={_descriptionDraft}
  close={_closeDescriptionDialog}
  copy={_copy}
  description={_selectedDescription}
  descriptionEditedAt={moderationDescriptionEditedAt}
  descriptionTargetHref={moderationDescriptionTargetHref}
  enhanceAction={enhanceAdminAction("description", () => {
    _closeDescriptionDialog();
    toast.success(_copy.descriptionUpdateSuccess);
  })}
  formatDate={_formatDate}
  formatMessage={moderationFormatMessage}
  inputValue={inputValue}
  isSaving={_pendingServerAction === "description"}
  targetLabel={(item) => moderationTargetLabel(item, _copy)}
/>
