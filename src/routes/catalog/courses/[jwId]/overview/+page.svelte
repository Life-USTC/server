<script lang="ts">
import CourseDetailBasicInfo from "@/features/catalog/components/CourseDetailBasicInfo.svelte";
import CourseDetailPageController from "@/features/catalog/components/CourseDetailPageController.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<CourseDetailPageController {data}>
  {#snippet content({ data, copy, detailCopy, primaryName })}
    <section id="overview" data-detail-tab="overview">
      <CourseDetailBasicInfo
        copy={detailCopy}
        course={data.course}
        {primaryName}
      />
    </section>
  {/snippet}
</CourseDetailPageController>
