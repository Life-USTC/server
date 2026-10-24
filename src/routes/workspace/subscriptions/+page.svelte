<script lang="ts">
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import WorkspacePageController from "@/features/workspace/components/WorkspacePageController.svelte";
import type { ActionData, PageData } from "./$types";

export let data: PageData;
export let form: ActionData | undefined = undefined;
</script>

{#if data.demo}
  <DemoNotice demo={data.demo} locale={data.locale} />
{/if}

{#key data.demo ? `${data.demo.fixtureVersion}:${data.demo.expiresAt}` : data.navStats?.user.id}
  <WorkspacePageController {data} {form} />
{/key}
