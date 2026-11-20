<script lang="ts">
import type { ComponentProps } from "svelte";
import SectionDetailPageController from "@/features/section-detail/components/SectionDetailPageController.svelte";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import type { ActionData, PageData } from "./$types";

export let content: ComponentProps<
  typeof SectionDetailPageController
>["content"];
export let data: PageData;
export let form: ActionData;
const shellViewer = getShellViewer();
</script>

{#key `${data.section.id}:${data.focusedHomeworkId ?? ""}:${data.showSubscribeDialog}:${$shellViewer.status}:${$shellViewer.viewer?.id ?? ""}`}
  <SectionDetailPageController {data} {form} {content} />
{/key}
