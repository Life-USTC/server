<script lang="ts">
import type { Snippet } from "svelte";
import DetailPageLayout from "./DetailPageLayout.svelte";
import PageHeader from "./PageHeader.svelte";
import PageLayout from "./PageLayout.svelte";
import Panel from "./Panel.svelte";

type PageFrameWidth = "reading" | "content" | "wide" | "full";
type PageDensity = "comfortable" | "detail" | "compact";
type PageTemplateLayout = "stack" | "detail";

/**
 * Page skeleton for every content page. Copy it and fill the slots:
 *
 * <CollectionPage title description footer={pagination}>
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
type Props = {
  actions?: Snippet;
  actionsClass?: string;
  after?: Snippet;
  aside?: Snippet;
  before?: Snippet;
  belowTitle?: Snippet;
  children: Snippet;
  class?: string;
  density?: PageDensity;
  description?: string;
  eyebrow?: string;
  eyebrowContent?: Snippet;
  footer?: Snippet;
  identity?: Snippet;
  header?: Snippet;
  headerClass?: string;
  layout?: PageTemplateLayout;
  lead?: Snippet;
  meta?: Snippet;
  panel?: boolean;
  title?: string;
  titleClass?: string;
  titleExtra?: Snippet;
  toolbar?: Snippet;
  width?: PageFrameWidth;
};

let {
  actions,
  actionsClass = "",
  after,
  aside: asideContent,
  before,
  belowTitle,
  children,
  class: className,
  density = "comfortable",
  description = "",
  eyebrow = "",
  eyebrowContent,
  footer,
  identity,
  header: customHeader,
  headerClass = "",
  layout = "stack",
  lead,
  meta,
  panel = true,
  title,
  titleClass = "",
  titleExtra,
  toolbar,
  width = "wide",
}: Props = $props();
</script>

{#snippet pageHeader()}
  {#if customHeader}
    {@render customHeader()}
  {:else if title}
    {#if lead}
      <div class="grid min-w-0 gap-3">
        {@render lead()}
        <PageHeader
          {actions}
          {actionsClass}
          {after}
          {belowTitle}
          class={headerClass}
          {description}
          {density}
          {eyebrow}
          {eyebrowContent}
          {meta}
          {title}
          {titleClass}
          {titleExtra}
        />
      </div>
    {:else}
      <PageHeader
        {actions}
        {actionsClass}
        {after}
        {belowTitle}
        class={headerClass}
        {description}
        {density}
        {eyebrow}
        {eyebrowContent}
        {meta}
        {title}
        {titleClass}
        {titleExtra}
      />
    {/if}
  {/if}
{/snippet}

{#if layout === "detail"}
  <DetailPageLayout {identity}>
    {#snippet header()}
      {@render pageHeader()}
    {/snippet}
    {@render children()}
    {#snippet aside()}
      {#if asideContent}{@render asideContent()}{/if}
    {/snippet}
  </DetailPageLayout>
{:else}
  <PageLayout {width} class={className}>
    {#snippet header()}
      {@render pageHeader()}
    {/snippet}
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
