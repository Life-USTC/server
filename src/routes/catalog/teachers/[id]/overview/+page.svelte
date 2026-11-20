<script lang="ts">
import TeacherDetailBasicInfo from "@/features/catalog/components/TeacherDetailBasicInfo.svelte";
import TeacherDetailPageController from "@/features/catalog/components/TeacherDetailPageController.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<TeacherDetailPageController {data}>
  {#snippet content({ data, copy, detailCopy })}
    <section id="overview" data-detail-tab="overview">
      <TeacherDetailBasicInfo
        copy={detailCopy}
        teacher={data.teacher}
      />
    </section>
  {/snippet}
</TeacherDetailPageController>
