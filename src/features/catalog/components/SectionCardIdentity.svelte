<script lang="ts">
import * as Item from "#lib/components/ui/item/index.js";
import {
  type CatalogNamed,
  catalogLocalizedDisplayName,
  catalogLocalizedNames,
} from "@/features/catalog/lib/catalog-list-display";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import CatalogEntityName from "./CatalogEntityName.svelte";

export let course: CatalogNamed | null | undefined;
export let teachers: CatalogNamed[] = [];
export let code: string;
export let semester: { nameCn?: string | null } | null | undefined;
export let locale: string;

$: hasCourseName = Boolean(catalogLocalizedDisplayName(course, locale));
$: teacherNames = catalogLocalizedNames(teachers, locale);
</script>

<Item.Content class="min-w-0 basis-full gap-1">
  <Item.Title class="block w-full line-clamp-none break-words [overflow-wrap:anywhere]">
    {#if hasCourseName}<CatalogEntityName item={course} {locale} />{:else}<span class="font-mono">{code}</span>{/if}
  </Item.Title>
  {#if teacherNames}
    <Item.Description class="line-clamp-none break-words">{teacherNames}</Item.Description>
  {/if}
  {#if hasCourseName || semester?.nameCn}
  <div class="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
    {#if hasCourseName}<span class="min-w-0 font-mono [overflow-wrap:anywhere]" data-slot="catalog-code">{code}</span>{/if}
    {#if semester?.nameCn}<span>{formatSemesterName(locale, semester.nameCn)}</span>{/if}
  </div>
  {/if}
</Item.Content>
