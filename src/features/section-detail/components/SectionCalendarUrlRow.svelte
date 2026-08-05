<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import LinkIcon from "@lucide/svelte/icons/link-2";
import * as Field from "$lib/components/ui/field/index.js";
import * as InputGroup from "$lib/components/ui/input-group/index.js";

export let buttonLabel: string;
export let copied: boolean;
export let copiedLabel: string;
export let description = "";
export let id: string;
export let label: string;
export let missingLabel = "";
export let onCopy: () => void | Promise<void>;
export let value: string;
export let warning = "";
</script>

<Field.Field>
  <Field.Label for={id}>{label}</Field.Label>
  {#if description}
    <Field.Description>{description}</Field.Description>
  {/if}
  <InputGroup.Root>
    <InputGroup.Input
      {id}
      class="truncate"
      disabled={!value}
      readonly
      title={value || missingLabel}
      value={value || missingLabel}
    />
    <InputGroup.Addon align="inline-end">
      <InputGroup.Button
        class="whitespace-nowrap"
        variant="secondary"
        disabled={!value}
        type="button"
        onclick={onCopy}
      >
        {#if copied}
          <CheckCircleIcon data-icon="inline-start" />
          {copiedLabel}
        {:else}
          <LinkIcon data-icon="inline-start" />
          {buttonLabel}
        {/if}
      </InputGroup.Button>
    </InputGroup.Addon>
  </InputGroup.Root>
  {#if warning}
    <p class="text-muted-foreground text-xs leading-5">{warning}</p>
  {/if}
</Field.Field>
