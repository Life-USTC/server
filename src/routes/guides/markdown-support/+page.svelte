<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
import type { PageData } from "./$types";
import MarkdownGuideSection from "./MarkdownGuideSection.svelte";
import { buildMarkdownGuideSections } from "./markdown-guide-sections";

export let data: PageData;

$: guide = data.copy.commentsGuide;
$: sections = buildMarkdownGuideSections(guide);
</script>

<svelte:head><title>{guide.title} - Life@USTC</title></svelte:head>

<section class="grid gap-6 pb-12">
  <PageHeader title={guide.title} description={guide.subtitle}>
    {#snippet breadcrumb()}
      <Breadcrumb.Root>
        <Breadcrumb.List>
          <Breadcrumb.Item><Breadcrumb.Link href="/">{data.copy.common.home}</Breadcrumb.Link></Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item><Breadcrumb.Page>{guide.title}</Breadcrumb.Page></Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>
    {/snippet}
    {#snippet meta()}
      <div class="flex flex-wrap gap-2">
        {#each sections as section}
          <Badge variant="ghost">{section.title}</Badge>
        {/each}
      </div>
    {/snippet}
  </PageHeader>

  <div class="grid gap-6">
    {#each sections as section, index}
      <MarkdownGuideSection
        index={index}
        previewTitle={guide.previewTitle}
        {section}
      />
    {/each}
  </div>
</section>
