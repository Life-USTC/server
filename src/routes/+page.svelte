<script lang="ts">
import PageLayout from "#lib/components/PageLayout.svelte";
import HomePageController from "@/features/workspace/components/HomePageController.svelte";
import { page } from "$app/state";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();

/**
 * Legacy overview dates reach the private client fetch while the page load
 * stays viewer-independent.
 */
const snapshotAt = $derived(page.url.searchParams.get("snapshotAt"));
const overviewWeek = $derived(page.url.searchParams.get("overviewWeek"));
</script>

<PageLayout>
  <HomePageController {data} {snapshotAt} {overviewWeek} />
</PageLayout>
