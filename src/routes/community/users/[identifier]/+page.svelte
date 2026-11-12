<script lang="ts">
import { onMount } from "svelte";
import { homePublicReadEpoch } from "@/features/demo/lib/demo-home-owner";
import ProfileView from "@/features/profile/components/ProfileView.svelte";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import type { PageData } from "./$types";

export let data: PageData;
const shellViewer = getShellViewer();
let mounted = false;
let expired = false;
let expiry: number | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

function armExpiry(next: number | undefined) {
  if (expiry === next) return;
  clearTimeout(timer);
  expiry = next;
  expired = next !== undefined && next <= Date.now();
  if (next !== undefined && !expired)
    timer = setTimeout(() => {
      expired = true;
    }, next - Date.now());
}
$: if (mounted) armExpiry(data.pageDemo?.expiresAt);
$: epoch = homePublicReadEpoch($shellViewer, data.pageDemo);
$: validDeadline = !data.pageDemo || data.pageDemo.expiresAt > Date.now();
$: owner =
  !expired && validDeadline && data.pageLocale === data.locale && epoch
    ? `${epoch}:${data.pageLocale}:${data.user.id}`
    : "";
onMount(() => {
  mounted = true;
  return () => {
    mounted = false;
    clearTimeout(timer);
  };
});
</script>

<svelte:head>
  <title>{owner ? data.socialMetadata.title : "Life@USTC"}</title>
</svelte:head>

{#if owner}
  {#key owner}<ProfileView profile={data} demo={data.demo} />{/key}
{/if}
