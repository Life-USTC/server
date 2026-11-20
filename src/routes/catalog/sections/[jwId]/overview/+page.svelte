<script lang="ts">
import SectionBasicInfoCard from "@/features/section-detail/components/SectionBasicInfoCard.svelte";
import SectionDetailIdentity from "@/features/section-detail/components/SectionDetailIdentity.svelte";
import SectionDetailRoute from "../SectionDetailRoute.svelte";
import type { ActionData, PageData } from "./$types";

let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<SectionDetailRoute {data} {form}>
  {#snippet content({ data, sectionCopy, notAvailable, primaryName, displaySection, sectionTeachersLabel, teacherName })}
    <section id="overview" data-detail-tab="overview" class="grid gap-4">
      <div data-detail-identity>
        <SectionDetailIdentity {notAvailable} {primaryName} section={displaySection} {sectionCopy} {teacherName} teachers={displaySection.teachers} />
      </div>
      <SectionBasicInfoCard
        notAvailable={notAvailable}
        primaryName={primaryName}
        section={displaySection}
        sectionCopy={sectionCopy}
        sectionTeachersLabel={sectionTeachersLabel}
      />
    </section>
  {/snippet}
</SectionDetailRoute>
