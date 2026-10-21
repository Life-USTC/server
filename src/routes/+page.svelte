<script lang="ts">
import PageLayout from "#lib/components/PageLayout.svelte";
import AnonymousHomePageController from "@/features/workspace/components/AnonymousHomePageController.svelte";
import type { PageData } from "./$types";

export let data: PageData;
</script>

<PageLayout>
  <AnonymousHomePageController {data} />
</PageLayout>
