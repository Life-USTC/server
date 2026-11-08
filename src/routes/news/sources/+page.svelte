<script lang="ts">
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import { homePublicReadEpoch } from "@/features/demo/lib/demo-home-owner";
import PublicationSourceDirectoryPage from "@/features/publications/components/PublicationSourceDirectoryPage.svelte";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import { browser } from "$app/env";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const shellViewer = getShellViewer();
const readEpoch = $derived(homePublicReadEpoch($shellViewer, data.demo));
const readable = $derived(!browser || Boolean(readEpoch));
</script>

{#if data.demo}<DemoNotice demo={data.demo} locale={data.locale} /><p class="mb-4 text-sm" data-testid="demo-news-fictional">{data.newsSampleNotice}</p>{/if}
{#if readable}{#key `${readEpoch}:${data.demo ? data.locale : ""}`}<PublicationSourceDirectoryPage data={data} copy={data.copy} />{/key}{/if}
