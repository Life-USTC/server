<script lang="ts">
import type { Snippet } from "svelte";
import PageHeader from "./PageHeader.svelte";
import PageLayout from "./PageLayout.svelte";
import Panel from "./Panel.svelte";

type PageFrameWidth = "reading" | "content" | "wide" | "full";

/**
 * List-page skeleton. Copy it and fill the slots:
 *
 * <CollectionPage title description footer={pagination}>
 *   {#snippet actions()}header buttons{/snippet}
 *   {#snippet before()}optional note above the list{/snippet}
 *   {#snippet toolbar()}filters{/snippet}
 *   results
 * </CollectionPage>
 */
type Props = {
  actions?: Snippet;
  before?: Snippet;
  children: Snippet;
  class?: string;
  description?: string;
  footer?: Snippet;
  title: string;
  titleClass?: string;
  toolbar?: Snippet;
  width?: PageFrameWidth;
};

let {
  actions,
  before,
  children,
  class: className,
  description = "",
  footer,
  title,
  titleClass = "",
  toolbar,
  width = "wide",
}: Props = $props();
</script>

<PageLayout {width} class={className}>
  {#snippet header()}
    <PageHeader {actions} {description} {title} {titleClass} />
  {/snippet}
  {#if before}
    {@render before()}
  {/if}
  <Panel {footer} header={toolbar}>
    {@render children()}
  </Panel>
</PageLayout>
