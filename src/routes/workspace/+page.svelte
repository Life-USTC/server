<script lang="ts">
import WorkspacePageController from "@/features/workspace/components/WorkspacePageController.svelte";
import type { ActionData, PageData } from "./$types";

export let data: PageData;
export let form: ActionData | undefined = undefined;
</script>

<WorkspacePageController {data} {form} />
