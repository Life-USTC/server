<script lang="ts">
import CollectionPage from "#lib/components/CollectionPage.svelte";
import DemoInformationPage from "@/features/demo/components/DemoInformationPage.svelte";
import type { PageData } from "./$types";
import MarkdownGuideSection from "./MarkdownGuideSection.svelte";
import { buildMarkdownGuideSections } from "./markdown-guide-sections";

export let data: PageData;

$: guide = data.copy.commentsGuide;
$: sections = buildMarkdownGuideSections(guide);
</script>

<DemoInformationPage pageDemo={data.pageDemo} pageLocale={data.pageLocale} locale={data.locale} demo={data.demo} title={`${guide.title} - Life@USTC`}>

<CollectionPage class="pb-12" description={guide.subtitle} panel={false} title={guide.title}>

  <div class="grid gap-6">
    {#each sections as section, index}
      <MarkdownGuideSection
        index={index}
        previewTitle={guide.previewTitle}
        {section}
      />
    {/each}
  </div>
</CollectionPage>

</DemoInformationPage>
