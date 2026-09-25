<script lang="ts">
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { page } from "$app/stores";
import { Button } from "$lib/components/ui/button";
import { type YoungBrowseView, youngBrowseHref } from "../lib/young-navigation";

let {
  current,
  copy,
}: { current: YoungBrowseView; copy: AppPageCopy["youngEvents"] } = $props();
</script>
<nav aria-label={copy.title} class="mb-4 flex flex-wrap gap-2" data-testid="young-browse-nav">
  {#each [{ view: "events" as const, label: copy.eventName }, { view: "calendar" as const, label: copy.viewCalendar }, { view: "organizers" as const, label: copy.viewOrganizers }] as item (item.view)}
    <Button href={youngBrowseHref($page.url, item.view)} variant={current === item.view ? "secondary" : "ghost"} aria-current={current === item.view ? "page" : undefined}>{item.label}</Button>
  {/each}
</nav>
