<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import PageHeaderMeta from "$lib/components/PageHeaderMeta.svelte";
import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";

export let currentLabel: string;
export let description: string;
export let homeLabel: string;
export let metaLabel: string;
export let metaValue: string;
export let title: string;
</script>

<PageHeader {title} {description}>
  {#snippet breadcrumb()}
    <Breadcrumb.Root>
      <Breadcrumb.List>
        <Breadcrumb.Item><Breadcrumb.Link href="/">{homeLabel}</Breadcrumb.Link></Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item><Breadcrumb.Page>{currentLabel}</Breadcrumb.Page></Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb.Root>
  {/snippet}
  {#snippet meta()}
    <PageHeaderMeta label={metaLabel} value={metaValue} />
  {/snippet}
</PageHeader>
