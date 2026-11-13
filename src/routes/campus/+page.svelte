<script lang="ts">
import { get } from "svelte/store";
import FeatureDirectory from "#lib/components/shell/FeatureDirectory.svelte";
import { getShellViewer } from "#lib/shell/shell-viewer.js";
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import { guardDemoDocumentLinks } from "@/features/demo/lib/demo-document-links";
import { homePublicReadEpoch } from "@/features/demo/lib/demo-home-owner";
import { isDemoNavigationDestination } from "@/features/demo/lib/demo-navigation";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const shellViewer = getShellViewer();
let expired = $state(false);
let epoch = $derived(homePublicReadEpoch($shellViewer, data.pageDemo));
let readable = $derived(
  !expired &&
    Boolean(epoch) &&
    data.locale === data.pageLocale &&
    (!data.pageDemo || data.pageDemo.expiresAt > Date.now()),
);
$effect(() => {
  expired = Boolean(data.pageDemo && data.pageDemo.expiresAt <= Date.now());
  if (!data.pageDemo) return;
  const timer = setTimeout(
    () => {
      expired = true;
    },
    Math.max(0, data.pageDemo.expiresAt - Date.now()),
  );
  return () => clearTimeout(timer);
});
function currentEpoch() {
  if (
    expired ||
    data.locale !== data.pageLocale ||
    (data.pageDemo && data.pageDemo.expiresAt <= Date.now())
  )
    return "";
  return homePublicReadEpoch(get(shellViewer), data.pageDemo);
}
function directoryLinks(root: HTMLElement) {
  const owner = currentEpoch();
  const stop = guardDemoDocumentLinks(root, {
    isCurrent: () => Boolean(owner) && currentEpoch() === owner,
    isAllowed: (url) =>
      !get(shellViewer).demo ||
      (url.origin === location.origin &&
        isDemoNavigationDestination(`${url.pathname}${url.search}${url.hash}`)),
    reason: data.campusDemo?.readOnlyReason ?? "",
  });
  return { destroy: stop };
}
</script>

<svelte:head
  ><title>{data.campusCopy.shell.primaryDestinations.campus} · Life@USTC</title
  ></svelte:head
>
{#if readable}
  {#key `${epoch}:${data.pageLocale}`}
    <div
      use:directoryLinks
      class="mx-auto w-full max-w-7xl flex flex-col gap-6"
    >
      {#if data.campusDemo}<DemoNotice
          demo={data.campusDemo}
          locale={data.pageLocale}
        />{/if}
      <header class="flex flex-col gap-2">
        <h1 class="text-2xl font-semibold tracking-tight">
          {data.campusCopy.shell.primaryDestinations.campus}
        </h1>
        <p class="text-muted-foreground">
          {data.campusCopy.shell.primaryDestinations.campusDescription}
        </p>
      </header>
      <FeatureDirectory
        copy={data.campusCopy}
        publicOnly
        groupFilter={["courses", "campus"]}
        searchId="campus-feature-search"
        signInCallbackUrl="/campus"
      />
    </div>
  {/key}
{/if}
