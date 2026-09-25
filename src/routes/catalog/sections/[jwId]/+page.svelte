<script lang="ts">
import SectionDetailPageController from "@/features/section-detail/components/SectionDetailPageController.svelte";
import type { ActionData, PageData } from "./$types";

export let data: PageData;
export let form: ActionData;
</script>

{#key `${data.section.id}:${data.focusedHomeworkId ?? ""}:${data.showSubscribeDialog}`}
  <SectionDetailPageController {data} {form} />
{/key}
