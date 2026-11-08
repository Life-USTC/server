<script lang="ts">
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import { homePublicReadEpoch } from "@/features/demo/lib/demo-home-owner";
import YoungCalendarPage from "@/features/young/components/YoungCalendarPage.svelte";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import { browser } from "$app/env";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const shellViewer = getShellViewer();
const demo = $derived("youngSampleNotice" in data ? data.demo : null);
const readEpoch = $derived(homePublicReadEpoch($shellViewer, demo));
const readable = $derived(!browser || Boolean(readEpoch));
const restricted = $derived(Boolean(demo || $shellViewer.demo));
</script>

<svelte:head>
  <title>{data.copy.youngEvents.calendarTitle} - Life@USTC</title>
</svelte:head>
{#if demo}<DemoNotice {demo} locale={data.locale} /><p class="mb-4 text-sm" data-testid="demo-young-fictional">{"youngSampleNotice" in data ? data.youngSampleNotice : ""}</p>{/if}
{#if readable}


{#key `${readEpoch}:${demo ? data.locale : ""}`}<YoungCalendarPage readOnly={restricted} referenceNow={demo?.referenceNow} demoCalendarItems={"demoCalendarItems" in data ? data.demoCalendarItems : undefined}
  anchorDate={data.anchorDate}
  copy={data.copy}
  data={data.data}
  filters={data.filters}
  locale={data.locale}
  range={data.range}
  source={data.source}
  unknownDateCount={data.unknownDateCount}
  view={data.view}
/>
{/key}
{/if}
