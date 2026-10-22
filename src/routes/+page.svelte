<script lang="ts">
import PageLayout from "#lib/components/PageLayout.svelte";
import HomePageController from "@/features/workspace/components/HomePageController.svelte";
import { page } from "$app/state";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();

/**
 * The workspace `?snapshotAt=` deep link keeps working on `/`: the page load
 * stays viewer-independent, so the parameter is handed to the client fetch as
 * the overview's `atTime` instead of being resolved on the server.
 */
const snapshotAt = $derived(page.url.searchParams.get("snapshotAt"));
</script>

<PageLayout>
  <HomePageController {data} {snapshotAt} />
</PageLayout>
