<script lang="ts">
import TeacherDetailPageController from "@/features/catalog/components/TeacherDetailPageController.svelte";
import LazyDescriptionCard from "@/features/descriptions/components/LazyDescriptionCard.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<TeacherDetailPageController {data}>
  {#snippet content({ data, copy })}
    <section id="introduction" data-detail-tab="introduction" class="scroll-mt-4">
      {#key `description:teacher:${data.teacher.id}`}
        <LazyDescriptionCard
          resolveViewer
          targetType="teacher"
          targetId={data.teacher.id}
          initialData={data.descriptionData}
          locale={data.locale as "en-us" | "zh-cn"}
          copy={copy.descriptions}
          heading={copy.descriptions.title}
          readOnlyReason={data.demo?.readOnlyReason}
        />
      {/key}
    </section>
  {/snippet}
</TeacherDetailPageController>
