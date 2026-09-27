<script lang="ts">
import type { PublicationSourceOrganizationLevel } from "@/features/publications/lib/publication-source-levels";
import { Button } from "$lib/components/ui/button";
import { Checkbox } from "$lib/components/ui/checkbox";
import * as Field from "$lib/components/ui/field";
import PublicationSourceFilter from "./PublicationSourceFilter.svelte";
import type {
  PublicationListPageData,
  PublicationPageCopy,
} from "./publication-component-types";

let {
  copy,
  data,
  query,
  sourceDraft = $bindable(),
  levelsDraft = $bindable(),
  foldDraft = $bindable(),
  onsubmit,
}: {
  copy: PublicationPageCopy;
  data: PublicationListPageData;
  query: string;
  sourceDraft: string[];
  levelsDraft: PublicationSourceOrganizationLevel[];
  foldDraft: boolean;
  onsubmit: () => void;
} = $props();
const availableLevels = $derived([
  ...new Set(data.sourceOptions.map((option) => option.organizationLevel)),
]);
</script>

            <form method="get" action="/news" class="min-w-0" {onsubmit}>
              {#if data.filters.type}<input type="hidden" name="type" value={data.filters.type} />{/if}
              <input type="hidden" name="query" value={query} />
              <Field.Group class="min-w-0 gap-5">
                <PublicationSourceFilter options={data.sourceOptions} bind:selected={sourceDraft} {copy} />
                {#if availableLevels.length > 0}
                  <Field.Set class="min-w-0 gap-3">
                    <Field.Legend>{copy.organizationLevelFilter}</Field.Legend>
                    <Field.Group class="gap-3">
                      {#each availableLevels as level (level)}
                        <Field.Field orientation="horizontal" class="gap-2">
                          <Checkbox id={`publication-level-${level}`} name="organizationLevel" value={level} checked={levelsDraft.includes(level)} onCheckedChange={(checked) => { levelsDraft = checked ? [...levelsDraft, level] : levelsDraft.filter((item) => item !== level); }} />
                          <Field.Label for={`publication-level-${level}`}>{copy.organizationLevelLabels[level]}</Field.Label>
                        </Field.Field>
                      {/each}
                    </Field.Group>
                  </Field.Set>
                {/if}
                <Field.Field orientation="horizontal" class="gap-2">
                  <Checkbox id="publication-fold" name="fold" value="1" bind:checked={foldDraft} />
                  <Field.Label for="publication-fold">{copy.foldToggle}</Field.Label>
                </Field.Field>
                <Button type="submit" class="self-start">{copy.applyFilters}</Button>
              </Field.Group>
            </form>
