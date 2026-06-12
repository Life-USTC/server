<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { Textarea } from "$lib/components/ui/textarea/index.js";
import AdminModerationDescriptionMeta from "./AdminModerationDescriptionMeta.svelte";
import type { AdminModerationDescription } from "./admin-moderation-description-types";
import type { AdminModerationCopy } from "./admin-moderation-page-types";

export let close: () => void;
export let copy: AdminModerationCopy;
export let description: AdminModerationDescription | null;
export let descriptionDraft: string;
export let descriptionEditedAt: (
  description: AdminModerationDescription,
) => string | Date;
export let descriptionTargetHref: (
  description: AdminModerationDescription,
) => string;
export let enhanceAction: SubmitFunction;
export let formatDate: (value: string | Date) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let inputValue: (event: Event) => string;
export let isSaving: boolean;
export let targetLabel: (description: AdminModerationDescription) => string;
</script>

{#if description}
  <Dialog.Root
    open={true}
    class="max-w-3xl"
    aria-labelledby="manage-description-title"
    onOpenChange={(open) => {
      if (!open) close();
    }}
  >
    <form
      method="POST"
      action="?/moderateDescription"
      class="grid max-h-[calc(100vh-2rem)] overflow-y-auto"
      use:enhance={enhanceAction}
    >
      <Dialog.Header>
        <div class="flex items-start justify-between gap-3">
          <div>
            <Dialog.Title id="manage-description-title">{copy.manageDescription}</Dialog.Title>
            <Dialog.Description>
              {targetLabel(description)} · {formatMessage(copy.editedAt, { date: formatDate(descriptionEditedAt(description)) })}
            </Dialog.Description>
          </div>
          <Button size="sm" type="button" variant="ghost" onclick={close}>{copy.close}</Button>
        </div>
      </Dialog.Header>

      <div class="grid gap-4 px-5 py-4">
        <input type="hidden" name="id" value={description.id} />
        <AdminModerationDescriptionMeta
          {copy}
          {description}
          {descriptionTargetHref}
          {formatMessage}
        />

        <label class="grid gap-2">
          <span class="font-medium text-sm">{copy.descriptionContent}</span>
          <Textarea
            class="min-h-56"
            name="content"
            value={descriptionDraft}
            oninput={(event: Event) => {
              descriptionDraft = inputValue(event);
            }}
          />
        </label>
      </div>

      <Dialog.Footer>
        <Button
          disabled={isSaving}
          type="button"
          variant="ghost"
          onclick={close}
        >
          {copy.cancelButton}
        </Button>
        <Button disabled={isSaving} type="submit">
          {isSaving ? copy.saving : copy.confirmButton}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Root>
{/if}
