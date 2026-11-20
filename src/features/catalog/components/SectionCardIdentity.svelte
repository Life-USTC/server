<script lang="ts">
import type { Snippet } from "svelte";
import * as Item from "#lib/components/ui/item/index.js";
import { sectionSummary, type CatalogNamed } from "@/features/catalog/lib/catalog-list-display";

export let title: Snippet<[string]> | undefined = undefined;
export let course: CatalogNamed | null | undefined;
export let teachers: CatalogNamed[] = [];
export let code: string;
export let semester: { nameCn?: string | null } | null | undefined;
export let locale: string;

$: summary = sectionSummary({ course, semester, teachers, code }, locale);
</script>

<Item.Content class="min-w-0 basis-full gap-1">
  <Item.Title class="block w-full line-clamp-none break-words [overflow-wrap:anywhere]">
    {#if title}{@render title(summary)}{:else}{summary}{/if}
  </Item.Title>
  {#if code && summary !== code}
    <span class="font-mono text-xs text-muted-foreground" data-slot="catalog-code">{code}</span>
  {/if}
</Item.Content>
