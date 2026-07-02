<script lang="ts">
import SectionDetailPageController from "@/features/section-detail/components/SectionDetailPageController.svelte";
import type { ActionData, PageData } from "./$types";

export let data: PageData;
export let form: ActionData;
</script>

<SectionDetailPageController {data} {form} />
