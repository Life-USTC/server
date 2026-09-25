<script lang="ts">
import type { AppPageCopy } from "@/lib/shell/page-copy";
import { page } from "$app/stores";
import PageSectionNav from "$lib/components/PageSectionNav.svelte";
import { type YoungBrowseView, youngBrowseHref } from "../lib/young-navigation";

let {
  current,
  copy,
}: { current: YoungBrowseView; copy: AppPageCopy["youngEvents"] } = $props();
</script>
<div data-testid="young-browse-nav">
  <PageSectionNav ariaLabel={copy.title} items={[
    { href: youngBrowseHref($page.url, "events"), label: copy.eventName, current: current === "events" },
    { href: youngBrowseHref($page.url, "calendar"), label: copy.viewCalendar, current: current === "calendar" },
    { href: youngBrowseHref($page.url, "organizers"), label: copy.viewOrganizers, current: current === "organizers" },
  ]} />
</div>
