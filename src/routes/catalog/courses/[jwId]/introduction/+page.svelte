<script lang="ts">
import LazyDescriptionCard from "@/features/descriptions/components/LazyDescriptionCard.svelte";
import CourseDetailPageController from "@/features/catalog/components/CourseDetailPageController.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<CourseDetailPageController {data}>
  {#snippet content({ data, copy })}
    <section id="introduction" data-detail-tab="introduction" class="scroll-mt-4">
      {#key `description:course:${data.course.id}`}
        <LazyDescriptionCard
          resolveViewer
          targetType="course"
          targetId={data.course.id}
          initialData={data.descriptionData}
          locale={data.locale as "en-us" | "zh-cn"}
          copy={copy.descriptions}
          heading={copy.courseDetail.tabs.description}
          readOnlyReason={data.demo?.readOnlyReason}
        />
      {/key}
    </section>
  {/snippet}
</CourseDetailPageController>
