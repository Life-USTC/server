<script lang="ts">
import {
  type CatalogNamed,
  catalogPrimaryName,
  catalogSecondaryName,
} from "@/features/catalog/lib/catalog-list-display";

export let item: CatalogNamed | null | undefined;
export let locale: string;
$: primary = catalogPrimaryName(item) || catalogSecondaryName(item);
$: secondary = catalogSecondaryName(item);
</script>

<span data-slot="entity-primary-name">{primary}</span>{#if locale === "en-us" && secondary && secondary !== primary}{" "}<span class="text-[0.85em] font-normal text-muted-foreground" data-slot="entity-secondary-name">({secondary})</span>{/if}
