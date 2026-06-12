<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import AdminModerationComments from "@/features/admin/components/AdminModerationComments.svelte";
import AdminModerationDescriptions from "@/features/admin/components/AdminModerationDescriptions.svelte";
import AdminModerationHomeworks from "@/features/admin/components/AdminModerationHomeworks.svelte";
import AdminModerationSuspensions from "@/features/admin/components/AdminModerationSuspensions.svelte";
import type { AdminModerationComment } from "@/features/admin/components/admin-moderation-comment-types";
import type { AdminModerationDescription } from "@/features/admin/components/admin-moderation-description-types";
import type {
  AdminModerationCopy,
  AdminModerationDescriptionOptions,
  AdminModerationHomework,
  AdminModerationPageData,
} from "@/features/admin/components/admin-moderation-page-types";
import {
  moderationCommentAuthorLabel,
  moderationDescriptionTargetHref,
  moderationFormatMessage,
  moderationStatusBadgeClass,
  moderationStatusBorderClass,
  moderationStatusLabel,
  moderationTargetHref,
  moderationTargetLabel,
} from "@/features/admin/lib/moderation-display";
import type { PendingModerationServerAction } from "@/features/admin/lib/moderation-page-client-actions";

export let copy: AdminModerationCopy;
export let data: AdminModerationPageData;
export let descriptionContentOptions: AdminModerationDescriptionOptions;
export let descriptionTargetOptions: AdminModerationDescriptionOptions;
export let enhanceAdminAction: (
  action: PendingModerationServerAction,
) => SubmitFunction;
export let formatDate: (value: string | Date) => string;
export let isLiftingSuspension: boolean;
export let onDeleteHomework: (homework: AdminModerationHomework) => void;
export let onManageComment: (comment: AdminModerationComment) => void;
export let onManageDescription: (
  description: AdminModerationDescription,
) => void;
export let visibleComments: AdminModerationComment[];
</script>

{#if data.tab === "descriptions"}
  <AdminModerationDescriptions
    {copy}
    {descriptionContentOptions}
    descriptionContentFilter={data.filters.descriptionContent}
    descriptions={data.descriptions}
    descriptionTargetFilter={data.filters.descriptionTarget}
    descriptionTargetHref={(description: AdminModerationDescription) =>
      moderationDescriptionTargetHref(description)}
    {descriptionTargetOptions}
    formatDate={formatDate}
    formatMessage={moderationFormatMessage}
    onManage={onManageDescription}
    targetLabel={(item) => moderationTargetLabel(item, copy)}
  />
{:else if data.tab === "homeworks"}
  <AdminModerationHomeworks
    {copy}
    formatDate={formatDate}
    formatMessage={moderationFormatMessage}
    homeworks={data.homeworks}
    onDelete={onDeleteHomework}
  />
{:else if data.tab === "suspensions"}
  <AdminModerationSuspensions
    {copy}
    enhanceLiftSuspension={enhanceAdminAction("liftSuspension")}
    formatDate={formatDate}
    formatMessage={moderationFormatMessage}
    {isLiftingSuspension}
    suspensions={data.suspensions}
  />
{:else}
  <AdminModerationComments
    commentAuthorLabel={(comment) =>
      moderationCommentAuthorLabel(comment as AdminModerationComment, copy.guestLabel)}
    comments={visibleComments}
    {copy}
    formatDate={formatDate}
    onManage={onManageComment}
    statusBadgeClass={moderationStatusBadgeClass}
    statusBorderClass={moderationStatusBorderClass}
    statusLabel={(status) => moderationStatusLabel(status, copy)}
    targetHref={(comment: AdminModerationComment) => moderationTargetHref(comment)}
    targetLabel={(item) => moderationTargetLabel(item, copy)}
  />
{/if}
