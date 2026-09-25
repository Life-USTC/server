<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import AdminSuspensionFields from "./AdminSuspensionFields.svelte";
import type { AdminModerationComment } from "./admin-moderation-comment-types";
import type {
  AdminModerationCopy,
  AdminModerationDurationOption,
} from "./admin-moderation-page-types";

export let comment: AdminModerationComment;
export let copy: AdminModerationCopy;
export let customExpiresAt: string;
export let isSuspendingUser: boolean;
export let suspendCommentAuthor: () => void;
export let suspensionDuration: string;
export let suspensionDurationOptions: AdminModerationDurationOption[];
export let suspensionReason: string;
</script>

<Field.Set>
  <Field.Legend>{copy.suspensionDetails}</Field.Legend>
  <Field.Description>{copy.suspendAuthorDescription}</Field.Description>
  <AdminSuspensionFields
    compact
    copy={{
      durationLabel: copy.suspendExpires,
      expiresLabel: copy.suspendExpires,
      reasonLabel: copy.suspendReason,
      calendarButtonLabel: copy.calendarButtonLabel,
    }}
    idPrefix="moderation-suspension"
    expiresLabelId="moderation-suspension-custom-expires-label"
    bind:duration={suspensionDuration}
    bind:expiresAt={customExpiresAt}
    bind:reason={suspensionReason}
    options={suspensionDurationOptions}
  />
  <Button
    disabled={isSuspendingUser || !comment.user?.id}
    type="button"
    variant="destructive"
    onclick={suspendCommentAuthor}
  >
    {isSuspendingUser ? copy.suspending : copy.suspendAction}
  </Button>
</Field.Set>
