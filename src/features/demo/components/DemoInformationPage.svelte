<script lang="ts">
import type { Snippet } from "svelte";
import { get } from "svelte/store";
import { guardDemoDocumentLinks } from "@/features/demo/lib/demo-document-links";
import { homePublicReadEpoch } from "@/features/demo/lib/demo-home-owner";
import { isDemoInformationDestination } from "@/features/demo/lib/demo-information-paths";
import type { DemoIdentity, DemoView } from "@/features/demo/lib/demo-types";
import type { AppLocale } from "@/i18n/config";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import DemoNotice from "./DemoNotice.svelte";

let {
  pageDemo,
  pageLocale,
  locale,
  demo,
  title,
  children,
}: {
  pageDemo: DemoIdentity | null;
  pageLocale: AppLocale;
  locale: AppLocale;
  demo: DemoView | null;
  title?: string;
  children: Snippet;
} = $props();
const shellViewer = getShellViewer();
let expired = $state(false);
let readEpoch = $derived(homePublicReadEpoch($shellViewer, pageDemo));
let readable = $derived(
  !expired &&
    locale === pageLocale &&
    (!pageDemo || pageDemo.expiresAt > Date.now()) &&
    Boolean(readEpoch),
);

$effect(() => {
  void locale;
  void pageLocale;
  expired = Boolean(pageDemo && pageDemo.expiresAt <= Date.now());
  if (!pageDemo) return;
  const timer = setTimeout(
    () => {
      expired = true;
    },
    Math.max(0, pageDemo.expiresAt - Date.now()),
  );
  return () => clearTimeout(timer);
});

function currentEpoch() {
  if (
    expired ||
    locale !== pageLocale ||
    (pageDemo && pageDemo.expiresAt <= Date.now())
  )
    return "";
  const epoch = homePublicReadEpoch(get(shellViewer), pageDemo);
  return epoch ? `${epoch}:${pageDemo ? pageLocale : ""}` : "";
}
function documentLinks(root: HTMLElement) {
  const epoch = currentEpoch();
  const stop = guardDemoDocumentLinks(root, {
    isCurrent: () => Boolean(epoch) && currentEpoch() === epoch,
    isAllowed: (url) =>
      !get(shellViewer).demo ||
      isDemoInformationDestination(url, window.location.origin),
    reason: demo?.readOnlyReason ?? "",
  });
  return { destroy: stop };
}
</script>

<svelte:head>
  {#if title}<title>{readable ? title : "Life@USTC"}</title>{/if}
</svelte:head>

{#if readable}
  {#key `${readEpoch}:${pageDemo ? pageLocale : ""}`}
    <div class="min-w-0" data-testid="demo-information-document" use:documentLinks>
      {#if pageDemo && demo}
        <DemoNotice {demo} {locale} />
        <span id="demo-information-reason" class="sr-only">{demo.readOnlyReason}</span>
      {/if}
      {@render children()}
    </div>
  {/key}
{/if}
