<script lang="ts">
import { subscriptionKindSchema } from "@/features/subscriptions/lib/subscription-kind";
import { saveSubscriptionKind } from "@/features/subscriptions/lib/subscription-kind-client";
import type {
  WorkspaceSubscribedSection,
  WorkspaceSubscriptionsCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import { invalidateAll } from "$app/navigation";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";

export let section: WorkspaceSubscribedSection;
export let copy: WorkspaceSubscriptionsCopy["kindEditor"];
export let onClose: () => void;

let kind: string = section.kind;
let saving = false;
let error = "";

async function save() {
  const parsed = subscriptionKindSchema.safeParse(kind);
  if (saving || !parsed.success) return;
  saving = true;
  error = "";
  try {
    await saveSubscriptionKind(section.jwId, parsed.data, copy.failed);
    await invalidateAll();
    onClose();
  } catch (cause) {
    error = cause instanceof Error ? cause.message : copy.failed;
  } finally {
    saving = false;
  }
}
</script>

<Dialog.Root open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{copy.title}</Dialog.Title>
      <Dialog.Description>{section.course.namePrimary}</Dialog.Description>
    </Dialog.Header>
    <form onsubmit={(event) => { event.preventDefault(); void save(); }}>
      <Field.FieldGroup>
        <Field.Field data-invalid={Boolean(error)}>
          <Field.FieldLabel id="subscription-kind-label">{copy.title}</Field.FieldLabel>
          <ToggleGroup.Root type="single" variant="outline" bind:value={kind} disabled={saving} aria-labelledby="subscription-kind-label" aria-invalid={Boolean(error)}>
            {#each subscriptionKindSchema.options as option}
              <ToggleGroup.Item value={option}>{copy[option]}</ToggleGroup.Item>
            {/each}
          </ToggleGroup.Root>
          {#if error}<Field.FieldError>{error}</Field.FieldError>{/if}
        </Field.Field>
        <Dialog.Footer>
          <Button type="button" variant="outline" disabled={saving} onclick={onClose}>{copy.cancel}</Button>
          <Button type="submit" disabled={saving || !kind}>
            {#if saving}<Spinner data-icon="inline-start" />{/if}
            {copy.save}
          </Button>
        </Dialog.Footer>
      </Field.FieldGroup>
    </form>
  </Dialog.Content>
</Dialog.Root>
