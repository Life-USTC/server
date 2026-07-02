<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import PageHeaderMeta from "$lib/components/PageHeaderMeta.svelte";

export let description: string;
export let metaLabel: string;
export let metaValue: string;
export let title: string;
</script>

<PageHeader {title} {description}>
  {#snippet meta()}
    <PageHeaderMeta label={metaLabel} value={metaValue} />
  {/snippet}
</PageHeader>
