<script lang="ts">
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import { homePublicReadEpoch } from "@/features/demo/lib/demo-home-owner";
import YoungEventDetailPage from "@/features/young/components/YoungEventDetailPage.svelte";
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
  <title>{data.event?.name ?? data.copy.youngEvents.notFound} - Life@USTC</title>
</svelte:head>
{#if demo}<DemoNotice {demo} locale={data.locale} /><p class="mb-4 text-sm" data-testid="demo-young-fictional">{"youngSampleNotice" in data ? data.youngSampleNotice : ""}</p>{/if}
{#if readable}


{#if data.event}{#key `${readEpoch}:${demo ? data.locale : ""}`}
  <YoungEventDetailPage readOnly={restricted} readOnlyReason={demo?.readOnlyReason ?? ""} readOnlyLabel={"youngSubscriptionFactsLabel" in data ? data.youngSubscriptionFactsLabel : ""} subscriptionState={"subscriptionState" in data ? data.subscriptionState ?? undefined : undefined}
    commentsData={data.commentsData}
    copy={data.copy}
    event={data.event}
    source={data.source}
  />
{/key}{/if}

{/if}
