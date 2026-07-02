<script lang="ts">
import { onMount } from "svelte";
import { cn } from "$lib/utils.js";

type DetailSectionNavItem = {
  href: string;
  label: string;
  meta?: string | number;
};

export let ariaLabel: string;
export let activeHref = "";
export let items: DetailSectionNavItem[];
export let label = "";

$: currentHref = activeHref || items[0]?.href || "";
$: currentItem = items.find((item) => item.href === currentHref) ?? items[0];

function sectionIdFromHref(href: string) {
  return href.startsWith("#") ? href.slice(1) : "";
}

function selectItem(href: string) {
  activeHref = href;
}

function syncActiveFromScroll() {
  const offset = 128;
  let nextHref = items[0]?.href ?? "";

  if (
    window.innerHeight + window.scrollY >=
    document.documentElement.scrollHeight - 8
  ) {
    activeHref = items[items.length - 1]?.href ?? nextHref;
    return;
  }

  for (const item of items) {
    const sectionId = sectionIdFromHref(item.href);
    const section = sectionId ? document.getElementById(sectionId) : null;
    if (!section) continue;

    if (section.getBoundingClientRect().top <= offset) {
      nextHref = item.href;
    } else {
      break;
    }
  }

  if (nextHref) {
    activeHref = nextHref;
  }
}

function syncActiveFromHash() {
  const hashHref = window.location.hash;
  if (items.some((item) => item.href === hashHref)) {
    activeHref = hashHref;
    return;
  }
  syncActiveFromScroll();
}

onMount(() => {
  syncActiveFromHash();

  const onScroll = () => syncActiveFromScroll();
  const onHashChange = () => syncActiveFromHash();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("hashchange", onHashChange);
  requestAnimationFrame(syncActiveFromHash);

  return () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("hashchange", onHashChange);
  };
});
</script>

<aside
  class="overflow-hidden rounded-lg border border-base-300 bg-base-100 lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
  data-testid="detail-section-nav"
>
  <div class="border-base-300 border-b px-3 py-2">
    {#if label}
      <p class="font-medium text-[0.68rem] text-base-content/50 uppercase tracking-normal">
        {label}
      </p>
    {/if}
    <p class="truncate font-semibold text-sm">{currentItem?.label ?? ariaLabel}</p>
  </div>

  <nav aria-label={ariaLabel} class="p-2.5">
    <ol class="grid gap-0.5">
      {#each items as item}
        {@const active = item.href === currentHref}
        <li>
          <a
            class={cn(
              "detail-section-nav-link flex min-h-8 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm no-underline transition-colors",
              active
                ? "bg-base-200 font-medium text-base-content shadow-sm"
                : "text-base-content/70 hover:bg-base-200/70 hover:text-base-content",
            )}
            href={item.href}
            aria-current={active ? "location" : undefined}
            onclick={() => selectItem(item.href)}
          >
            <span class="truncate">{item.label}</span>
            {#if item.meta !== undefined && item.meta !== ""}
              <span
                class={cn(
                  "rounded-sm px-1.5 py-0.5 text-xs tabular-nums",
                  active
                    ? "bg-base-100 text-base-content/70"
                    : "bg-base-200 text-base-content/60",
                )}
              >
                {item.meta}
              </span>
            {/if}
          </a>
        </li>
      {/each}
    </ol>
  </nav>
</aside>
