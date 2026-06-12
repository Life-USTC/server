<script lang="ts">
import AdminModerationDialogs from "@/features/admin/components/AdminModerationDialogs.svelte";
import AdminModerationFilters from "@/features/admin/components/AdminModerationFilters.svelte";
import AdminModerationHeader from "@/features/admin/components/AdminModerationHeader.svelte";
import AdminModerationStatusAlerts from "@/features/admin/components/AdminModerationStatusAlerts.svelte";
import AdminModerationTabContent from "@/features/admin/components/AdminModerationTabContent.svelte";
import type { AdminModerationComment } from "@/features/admin/components/admin-moderation-comment-types";
import type { AdminModerationDescription } from "@/features/admin/components/admin-moderation-description-types";
import type {
  AdminModerationAdminCopy,
  AdminModerationCommonCopy,
  AdminModerationCopy,
  AdminModerationHomework,
  AdminModerationSuspension,
  AdminModerationTab,
} from "@/features/admin/components/admin-moderation-page-types";
import { createAdminModerationControllerDefaultState } from "@/features/admin/lib/admin-moderation-controller-default-state";
import {
  moderationHref as buildModerationHref,
  visibleModerationComments,
} from "@/features/admin/lib/moderation-display";
import { createModerationPageActions } from "@/features/admin/lib/moderation-page-actions";
import {
  buildCommentStatusOptions,
  buildDescriptionContentOptions,
  buildDescriptionTargetOptions,
  buildModerationTabs,
  buildStatusFilterOptions,
  buildSuspensionDurationOptions,
} from "@/features/admin/lib/moderation-page-options";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";
import { invalidateAll } from "$app/navigation";

type ModerationComment = AdminModerationComment;
type ModerationDescription = AdminModerationDescription;
type ModerationHomework = AdminModerationHomework;

type PageData = {
  comments: ModerationComment[];
  copy: {
    admin: AdminModerationAdminCopy;
    common: AdminModerationCommonCopy;
    moderation: AdminModerationCopy;
  };
  descriptions: ModerationDescription[];
  filters: {
    descriptionContent?: string | null;
    descriptionTarget?: string | null;
    search: string;
    status?: string | null;
  };
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
  _isRefreshingQueue,
  _isSavingComment,
  _isSuspendingUser,
  _moderationNote,
  _pendingDeleteHomework,
  _pendingServerAction,
  _refreshError,
  _searchQuery,
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
$: _commonCopy = data.copy.common;
$: _dateTimeFormatter = createShanghaiDateTimeFormatter(data.locale, {
  dateStyle: "medium",
  timeStyle: "short",
});
$: _tabs = buildModerationTabs(_copy, {
  comments: data.comments.length,
  descriptions: data.descriptions.length,
  homeworks: data.homeworks.length,
  suspensions: data.suspensions.length,
});
$: _commentStatusOptions = buildCommentStatusOptions(_copy);
$: statusFilterOptions = buildStatusFilterOptions(_copy);
$: descriptionTargetOptions = buildDescriptionTargetOptions(_copy);
$: descriptionContentOptions = buildDescriptionContentOptions(_copy);
$: suspensionDurationOptions = buildSuspensionDurationOptions(_copy);
$: _visibleComments = visibleModerationComments(data.comments, _searchQuery);

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
  setCommentStatus: (value) => {
    _commentStatus = value;
  },
  setCustomExpiresAt: (value) => {
    _customExpiresAt = value;
  },
  setDialogMessage: (value) => {
    _dialogMessage = value;
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
</script>

<svelte:head><title>{_copy.title} - Life@USTC</title></svelte:head>

<section class="grid gap-5">
  <AdminModerationHeader
    adminCopy={_adminCopy}
    commonCopy={_commonCopy}
    copy={_copy}
    currentTab={data.tab}
    isRefreshing={_isRefreshingQueue}
    moderationHref={(tab) => buildModerationHref(tab, data.filters)}
    refreshQueue={_refreshQueue}
    tabs={_tabs}
  />

  <AdminModerationStatusAlerts {form} refreshError={_refreshError} />

  <AdminModerationFilters
    copy={_copy}
    {descriptionContentOptions}
    {descriptionTargetOptions}
    filters={data.filters}
    bind:searchQuery={_searchQuery}
    {statusFilterOptions}
    tab={data.tab}
  />

  <AdminModerationTabContent
    copy={_copy}
    {data}
    {descriptionContentOptions}
    {descriptionTargetOptions}
    {enhanceAdminAction}
    formatDate={_formatDate}
    isLiftingSuspension={_pendingServerAction === "liftSuspension"}
    onDeleteHomework={(homework) => {
      _pendingDeleteHomework = homework;
    }}
    onManageComment={(comment) => _openCommentDialog(comment as ModerationComment)}
    onManageDescription={(description) =>
      _openDescriptionDialog(description as ModerationDescription)}
    visibleComments={_visibleComments}
  />

  <AdminModerationDialogs
    closeCommentDialog={_closeCommentDialog}
    closeDescriptionDialog={_closeDescriptionDialog}
    bind:commentStatus={_commentStatus}
    commentStatusOptions={_commentStatusOptions}
    copy={_copy}
    bind:customExpiresAt={_customExpiresAt}
    bind:descriptionDraft={_descriptionDraft}
    dialogMessage={_dialogMessage}
    deleteHomeworkAction={enhanceAdminAction("deleteHomework", () => {
      _pendingDeleteHomework = null;
    })}
    editDescriptionAction={enhanceAdminAction("description", _closeDescriptionDialog)}
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
</section>
