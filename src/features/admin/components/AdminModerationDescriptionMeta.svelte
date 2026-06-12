<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import type { AdminModerationDescription } from "./admin-moderation-description-types";
import type { AdminModerationCopy } from "./admin-moderation-page-types";

export let copy: AdminModerationCopy;
export let description: AdminModerationDescription;
export let descriptionTargetHref: (
  description: AdminModerationDescription,
) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
</script>

<section class="rounded border border-base-300 bg-base-200/40 p-4">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <p class="text-base-content/60 text-sm">
      {formatMessage(copy.lastEditor, {
        name: description.lastEditedBy?.name ?? description.lastEditedBy?.username ?? copy.notAvailable,
      })}
    </p>
    <div class="flex flex-wrap gap-2">
      <Button href={descriptionTargetHref(description)} size="sm" variant="outline">{copy.openTarget}</Button>
      {#if description.lastEditedBy?.id}
        <Button href={`/admin/users?search=${encodeURIComponent(description.lastEditedBy.id)}`} size="sm" variant="outline">{copy.manageUser}</Button>
      {/if}
    </div>
  </div>
</section>
