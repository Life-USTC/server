<script lang="ts">
import SectionBasicInfoCard from "@/features/section-detail/components/SectionBasicInfoCard.svelte";
import SectionDetailRoute from "../SectionDetailRoute.svelte";
import type { ActionData, PageData } from "./$types";

let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<SectionDetailRoute {data} {form}>
  {#snippet content({ data, sectionCopy, commonCopy, notAvailable, periodDetailRows, primaryName, displaySection, sectionTeachersLabel, yesNo })}
    <section id="overview" data-detail-tab="overview">
      <SectionBasicInfoCard
        commonCopy={commonCopy}
        notAvailable={notAvailable}
        periodDetailRows={periodDetailRows}
        primaryName={primaryName}
        section={displaySection}
        sectionCopy={sectionCopy}
        sectionTeachersLabel={sectionTeachersLabel}
        yesNo={yesNo}
      />
    </section>
  {/snippet}
</SectionDetailRoute>
