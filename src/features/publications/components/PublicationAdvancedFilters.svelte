<script lang="ts">
import { toolbarControlClass } from "#lib/components/toolbar-control.js";
import { Button } from "#lib/components/ui/button/index.js";
import { Checkbox } from "#lib/components/ui/checkbox/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import {
  publicationFilterIds,
  publicationFilterLevels,
} from "@/features/publications/lib/publication-filter-view";
import PublicationSourceFilter from "./PublicationSourceFilter.svelte";
import type {
  PublicationListPageData,
  PublicationPageCopy,
} from "./publication-component-types";

let {
  copy,
  data,
  values,
  onchange,
  onreset,
  disabled = false,
  formId,
}: {
  copy: PublicationPageCopy;
  data: PublicationListPageData;
  values: Record<string, string>;
  onchange: (patch: Record<string, string>) => void;
  onreset: () => void;
  disabled?: boolean;
  formId: string;
} = $props();
const availableLevels = $derived([
  ...new Set(data.sourceOptions.map((option) => option.organizationLevel)),
]);
</script>
<Field.Group class="min-w-0 gap-5">
  <PublicationSourceFilter options={data.sourceOptions} bind:selected={() => publicationFilterIds(values.source), selected => onchange({source:selected.join(",")})} {copy} {disabled} />
  {#if availableLevels.length > 0}
    <Field.Set class="min-w-0 gap-3">
      <Field.Legend>{copy.organizationLevelFilter}</Field.Legend>
      <Field.Group class="gap-3">
        {#each availableLevels as level (level)}
          <Field.Field orientation="horizontal" class="gap-2">
            <Checkbox id={`publication-level-${level}`} {disabled} checked={publicationFilterLevels(values.organizationLevel).includes(level)} onCheckedChange={checked=>{const levels=publicationFilterLevels(values.organizationLevel);onchange({organizationLevel:(checked?[...levels,level]:levels.filter(item=>item!==level)).join(",")});}} />
            <Field.Label for={`publication-level-${level}`}>{copy.organizationLevelLabels[level]}</Field.Label>
          </Field.Field>
        {/each}
      </Field.Group>
    </Field.Set>
  {/if}
  <Field.Field orientation="horizontal" class="gap-2">
    <Checkbox id="publication-fold" {disabled} checked={values.fold === "1"} onCheckedChange={checked=>onchange({fold:checked?"1":""})} />
    <Field.Label for="publication-fold">{copy.foldToggle}</Field.Label>
  </Field.Field>
  <div class="flex flex-wrap items-center gap-2">
    <Button type="submit" form={formId} {disabled} class={toolbarControlClass}>{copy.applyFilters}</Button>
    <Button type="button" {disabled} variant="outline" class={toolbarControlClass} onclick={onreset}>{copy.clearFilters}</Button>
  </div>
</Field.Group>
