<script lang="ts">
import CircleUserRound from "$lib/components/icons/circle-user-round.svelte";
import FileText from "$lib/components/icons/file-text.svelte";
import Link2 from "$lib/components/icons/link-2.svelte";
import ShieldAlert from "$lib/components/icons/shield-alert.svelte";
import type { LayoutData } from "./$types";

export let data: LayoutData;

$: activeTab = data.activeTab;

function tabIcon(icon: string) {
  if (icon === "accounts") return Link2;
  if (icon === "content") return FileText;
  if (icon === "danger") return ShieldAlert;
  return CircleUserRound;
}
</script>

<section class="mx-auto grid w-full max-w-5xl gap-6">
  <nav
    aria-label={data.settingsNav.title}
    class="grid gap-2 rounded-md border border-base-300 bg-base-100 p-2 shadow-sm sm:grid-cols-2 xl:grid-cols-4"
  >
    {#each data.settingsNav.tabs as item}
      {@const Icon = tabIcon(item.icon)}
      <a
        aria-current={activeTab === item.id ? "page" : undefined}
        class={`group grid grid-cols-[auto_1fr] gap-3 rounded-md border p-3 text-left transition-colors ${activeTab === item.id ? "border-primary/40 bg-primary/5 text-base-content shadow-sm" : "border-transparent text-base-content/70 hover:border-base-300 hover:bg-base-200/60 hover:text-base-content"} ${item.id === "danger" && activeTab !== item.id ? "hover:border-error/30 hover:bg-error/5" : ""}`}
        href={item.href}
      >
        <span
          class={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md border ${item.id === "danger" ? "border-error/30 bg-error/10 text-error" : activeTab === item.id ? "border-primary/30 bg-primary/10 text-primary" : "border-base-300 bg-base-100 text-base-content/60 group-hover:text-base-content"}`}
        >
          <Icon />
        </span>
        <span class="min-w-0">
          <span class="block font-medium text-sm">{item.title}</span>
          <span class="mt-1 block text-xs leading-5 text-base-content/60">
            {item.description}
          </span>
        </span>
      </a>
    {/each}
  </nav>
  <slot />
</section>
