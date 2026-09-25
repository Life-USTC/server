<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import PageLayout from "$lib/components/PageLayout.svelte";
import type { PageData } from "./$types";
import MarkdownGuideSection from "./MarkdownGuideSection.svelte";
import { buildMarkdownGuideSections } from "./markdown-guide-sections";

export let data: PageData;

$: guide = data.copy.commentsGuide;
$: sections = buildMarkdownGuideSections(guide);
</script>

<svelte:head><title>{guide.title} - Life@USTC</title></svelte:head>

<PageLayout class="pb-12">
{#snippet header()}
  <PageHeader title={guide.title} description={guide.subtitle} />
{/snippet}

  <div class="grid gap-6">
    {#each sections as section, index}
      <MarkdownGuideSection
        index={index}
        previewTitle={guide.previewTitle}
        {section}
      />
    {/each}
  </div>
</PageLayout>
