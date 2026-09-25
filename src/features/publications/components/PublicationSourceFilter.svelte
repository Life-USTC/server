<script lang="ts">
import { Checkbox } from "$lib/components/ui/checkbox";
import * as Field from "$lib/components/ui/field";
import { Input } from "$lib/components/ui/input";
import type {
  PublicationPageCopy,
  PublicationSourceOption,
} from "./publication-component-types";

let {
  options,
  selected,
  copy,
}: {
  options: PublicationSourceOption[];
  selected: string[];
  copy: PublicationPageCopy;
} = $props();
let query = $state("");
const visibleOptions = $derived(
  options.filter((option) =>
    option.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  ),
);
</script>

<Field.Set class="min-w-0 gap-3">
  <Field.Legend>{copy.sourceFilter}</Field.Legend>
  {#if options.length === 0}
    <Field.Description>{copy.sourceFilterEmpty}</Field.Description>
  {:else}
    <Field.Field class="gap-1">
      <Field.Label for="publication-source-search" class="sr-only">{copy.searchSources}</Field.Label>
      <Input id="publication-source-search" type="search" bind:value={query} placeholder={copy.searchSources} />
    </Field.Field>
    <Field.Group class="max-h-48 gap-2 overflow-y-auto overscroll-contain p-1">
      {#each options as option (option.id)}
        <div hidden={!visibleOptions.includes(option)}>
          <Field.Field orientation="horizontal" class="min-w-0 gap-2">
            <Checkbox id={`publication-source-${option.id}`} name="source" value={option.id} checked={selected.includes(option.id)} />
            <Field.Label for={`publication-source-${option.id}`} class="min-w-0 [overflow-wrap:anywhere]">{option.name}</Field.Label>
          </Field.Field>
        </div>
      {/each}
      {#if visibleOptions.length === 0}<p class="text-sm text-muted-foreground">{copy.sourceSearchEmpty}</p>{/if}
    </Field.Group>
    <Field.Description>{copy.sourceFilterHint}</Field.Description>
  {/if}
</Field.Set>
