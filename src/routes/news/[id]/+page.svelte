<script lang="ts">
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import { homePublicReadEpoch } from "@/features/demo/lib/demo-home-owner";
import PublicationDetailPage from "@/features/publications/components/PublicationDetailPage.svelte";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import { browser } from "$app/env";
import type { PageData } from "./$types";

export let data: PageData;
const shellViewer = getShellViewer();
$: readEpoch = homePublicReadEpoch($shellViewer, data.demo);
$: readable = !browser || Boolean(readEpoch);
$: restricted = Boolean(data.demo || $shellViewer.demo);
</script>

{#if data.demo}<DemoNotice demo={data.demo} locale={data.locale} /><p class="mb-4 text-sm" data-testid="demo-news-fictional">{data.newsSampleNotice}</p>{/if}
{#if readable}{#key `${readEpoch}:${data.demo ? data.locale : ""}`}<PublicationDetailPage data={data} copy={data.copy} readOnly={restricted} readOnlyReason={data.newsExternalUnavailable ?? ""} />{/key}{/if}
