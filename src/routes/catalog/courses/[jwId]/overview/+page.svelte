<script lang="ts">
import CourseDetailBasicInfo from "@/features/catalog/components/CourseDetailBasicInfo.svelte";
import CourseDetailIdentity from "@/features/catalog/components/CourseDetailIdentity.svelte";
import CourseDetailPageController from "@/features/catalog/components/CourseDetailPageController.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<CourseDetailPageController {data}>
  {#snippet content({ data, detailCopy, primaryName })}
    <section id="overview" data-detail-tab="overview" class="grid gap-2">
      <div data-detail-identity>
        <CourseDetailIdentity copy={detailCopy} course={data.course} {primaryName} />
      </div>
      <CourseDetailBasicInfo
        copy={detailCopy}
        course={data.course}
        {primaryName}
      />
    </section>
  {/snippet}
</CourseDetailPageController>
