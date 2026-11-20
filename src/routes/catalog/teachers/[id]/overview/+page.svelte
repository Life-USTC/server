<script lang="ts">
import TeacherDetailBasicInfo from "@/features/catalog/components/TeacherDetailBasicInfo.svelte";
import TeacherDetailIdentity from "@/features/catalog/components/TeacherDetailIdentity.svelte";
import TeacherDetailPageController from "@/features/catalog/components/TeacherDetailPageController.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<TeacherDetailPageController {data}>
  {#snippet content({ data, detailCopy, primaryName, notAvailable })}
    <section id="overview" data-detail-tab="overview" class="grid gap-2">
      <div data-detail-identity>
        <TeacherDetailIdentity copy={detailCopy} teacher={data.teacher} {primaryName} {notAvailable} />
      </div>
      <TeacherDetailBasicInfo
        copy={detailCopy}
        teacher={data.teacher}
      />
    </section>
  {/snippet}
</TeacherDetailPageController>
