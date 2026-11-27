<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import DetailPageLayout from "./DetailPageLayout.svelte";
import PageHeader from "./PageHeader.svelte";
import PageLayout from "./PageLayout.svelte";
import Panel from "./Panel.svelte";

type PageFrameWidth = "reading" | "content" | "wide" | "full";
type PageTemplateLayout = "stack" | "detail";

/**
 * Page skeleton for every content page. Copy it and fill the slots:
 *
 * <CollectionPage title description footer={loadMore}>
 *   {#snippet actions()}header buttons{/snippet}
 *   {#snippet before()}optional note above the body{/snippet}
 *   {#snippet toolbar()}filters{/snippet}
 *   results
 * </CollectionPage>
 *
 * Several sections: set panel={false} and put each section in Panel.
 * A two-column detail page: set layout="detail" and fill aside.
 * A custom header: pass the header snippet instead of title.
 */
type Props = Omit<ComponentProps<typeof PageHeader>, "title"> & {
  aside?: Snippet;
  before?: Snippet;
  children: Snippet;
  footer?: Snippet;
  header?: Snippet;
  headerClass?: string;
  layout?: PageTemplateLayout;
  lead?: Snippet;
  panel?: boolean;
  title?: string;
  toolbar?: Snippet;
  width?: PageFrameWidth;
};

let {
  aside: asideContent,
  before,
  children,
  class: className,
  footer,
  header: customHeader,
  headerClass = "",
  layout = "stack",
  lead,
  panel = true,
  title,
  toolbar,
  width = "wide",
  ...headerProps
}: Props = $props();
</script>

{#snippet defaultHeader(title: string)}
  <PageHeader {...headerProps} {title} class={headerClass} />
{/snippet}

{#snippet pageHeader()}
  {#if customHeader}
    {@render customHeader()}
  {:else if title}
    {#if lead}
      <div class="grid min-w-0 gap-3">
        {@render lead()}
        {@render defaultHeader(title)}
      </div>
    {:else}
      {@render defaultHeader(title)}
    {/if}
  {/if}
{/snippet}

{#if layout === "detail"}
  <DetailPageLayout aside={asideContent} header={pageHeader}>
    {@render children()}
  </DetailPageLayout>
{:else}
  <PageLayout {width} class={className} header={pageHeader}>
    {#if before}
      {@render before()}
    {/if}
    {#if panel}
      <Panel {footer} header={toolbar}>
        {@render children()}
      </Panel>
    {:else}
      {#if toolbar}
        {@render toolbar()}
      {/if}
      {@render children()}
      {#if footer}
        <div class="flex justify-center" data-slot="page-section-footer">{@render footer()}</div>
      {/if}
    {/if}
  </PageLayout>
{/if}
