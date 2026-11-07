<script lang="ts">
import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
import { onMount, tick } from "svelte";
import PageSectionNav from "#lib/components/PageSectionNav.svelte";
import type { LayoutCopy } from "#lib/shell/layout-server-data.js";
import { detailAnchorIds, detailNavigation } from "./detail-navigation";

let {
  pageData,
  pathname,
  hash,
  viewerReady,
  copy,
}: {
  pageData: Record<string, unknown>;
  pathname: string;
  hash: string;
  viewerReady: boolean;
  copy: LayoutCopy;
} = $props();
const detail = $derived(detailNavigation(pageData, pathname, copy));
const detailKind = $derived(pageData.shellDetail);
// Public details can remount after viewer hydration. A navigation owns one
// restoration; user input or departure cancels it before any late completion.
type Restoration = {
  key: string;
  userInteracted: boolean;
  target: Element | null;
  stop?: () => void;
};
let restoration: Restoration | null = null;
let mounted = $state(false);
let navigationElement: HTMLDivElement | undefined = $state();
let anchorActivation = $state(0);
function activateAnchor(href: string, event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey ||
    href !== hash ||
    !detailAnchorIds(detailKind).some((id) => `#${id}` === href)
  )
    return;
  // A same-hash TOC selection is a new explicit intent, including Enter after
  // an earlier manual scroll. It supersedes the pointer cancellation above.
  restoration?.stop?.();
  restoration = { key: pathname + hash, userInteracted: false, target: null };
  anchorActivation += 1;
}
onMount(() => {
  mounted = true;
  const cancel = () => {
    if (restoration) {
      restoration.userInteracted = true;
      restoration.stop?.();
    }
  };
  const cancelKey = (event: KeyboardEvent) => {
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
        " ",
      ].includes(event.key)
    )
      cancel();
  };
  window.addEventListener("wheel", cancel, { passive: true });
  window.addEventListener("touchstart", cancel, { passive: true });
  window.addEventListener("pointerdown", cancel, {
    passive: true,
    capture: true,
  });
  window.addEventListener("keydown", cancelKey, true);
  return () => {
    restoration?.stop?.();
    window.removeEventListener("wheel", cancel);
    window.removeEventListener("touchstart", cancel);
    window.removeEventListener("pointerdown", cancel, true);
    window.removeEventListener("keydown", cancelKey, true);
  };
});
$effect(() => {
  anchorActivation;
  const key = pathname + hash;
  const anchor = hash;
  if (!mounted) return;
  if (restoration?.key !== key)
    restoration = { key, userInteracted: false, target: null };
  const state = restoration;
  if (
    !viewerReady ||
    !detailAnchorIds(detailKind).some((id) => `#${id}` === anchor)
  )
    return;
  const root = navigationElement?.closest("[data-shell-scroll-container]");
  if (!root || state.userInteracted) return;
  let cancelled = false;
  let frame = 0;
  let scheduled = false;
  const current = () =>
    !cancelled &&
    !state.userInteracted &&
    restoration === state &&
    location.pathname + location.hash === key;
  const readyTarget = () => {
    if (!current()) return null;
    const target = root.querySelector<HTMLElement>(`[id="${anchor.slice(1)}"]`);
    if (
      !target ||
      target.childElementCount === 0 ||
      target.getBoundingClientRect().height === 0 ||
      root.querySelector(
        '[data-detail-scroll-container][aria-busy="true"], [data-detail-reading-stream] [aria-busy="true"], [data-detail-reading-stream] [data-slot="skeleton"]',
      )
    )
      return null;
    return target;
  };
  const observer = new MutationObserver(() => attempt());
  const stop = () => {
    cancelled = true;
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
  state.stop = stop;
  function attempt() {
    const target = readyTarget();
    if (!target || scheduled) return;
    if (state.target === target) {
      stop();
      return;
    }
    scheduled = true;
    void tick().then(() => {
      if (!current()) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        scheduled = false;
        const liveTarget = readyTarget();
        if (!liveTarget) return;
        liveTarget.scrollIntoView({ block: "start" });
        state.target = liveTarget;
        stop();
      });
    });
  }
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-busy"],
  });
  attempt();
  return stop;
});
</script>

{#if detail}
  <div bind:this={navigationElement} class="shrink-0 border-b bg-card px-4 py-2 sm:px-5 lg:px-6" data-testid="shell-detail-navigation">
    <div class="page-frame page-frame-content grid gap-1">
      <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <nav aria-label={copy.shell.currentLocation}>
          <ol class="flex min-w-0 flex-wrap items-center gap-1.5">
            <li><a class="underline-offset-4 hover:underline" href={detail.collection.href}>{detail.collection.label}</a></li>
            <li aria-hidden="true"><ChevronRightIcon class="size-3 text-muted-foreground" /></li>
            <li class="min-w-0 [overflow-wrap:anywhere]"><span aria-current="page">{detail.current.label}</span></li>
          </ol>
        </nav>
        {#if detail.courseHref}
          <a class="underline underline-offset-4" href={detail.courseHref} data-testid="section-course-link">{copy.shell.detailNavigation.relatedCourse}</a>
        {/if}
      </div>
      <PageSectionNav onActivate={activateAnchor} ariaLabel={copy.shell.detailNavigation.label} items={detail.anchors.map(item => ({...item, current: item.href === hash}))} />
    </div>
  </div>
{/if}
