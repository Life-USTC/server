<script lang="ts">
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import { Skeleton } from "#lib/components/ui/skeleton/index.js";
import { getShellViewer } from "#lib/shell/shell-viewer.js";
import { createWorkspaceCalendarDisplayActions } from "@/features/workspace/lib/workspace-controller-calendar-display-actions";
import { linkIconLabel } from "@/features/workspace/lib/workspace-link-icon";
import {
  applyCatalogLinkPinnedSlugs,
  currentCatalogLinkReturnTo,
  submitWorkspaceLinkPinRequest,
} from "@/features/workspace/lib/workspace-link-pin-client";
import { workspaceTabHref } from "@/features/workspace/lib/workspace-nav";
import type { AppLocale } from "@/i18n/config";
import { HOME_VIEWER_PATH } from "@/lib/navigation/internal-routes";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { browser } from "$app/env";
import OverviewTab from "./OverviewTab.svelte";
import type { OverviewSignedData } from "./overview-tab-types";

let {
  copy,
  locale,
  snapshotAt = null,
  overviewWeek = null,
}: {
  copy: { failed: string; retry: string; title: string };
  locale: AppLocale;
  snapshotAt?: string | null;
  overviewWeek?: string | null;
} = $props();

const shellViewer = getShellViewer();
const viewer = $derived($shellViewer.viewer);
const workspacePageCopy = $derived(getWorkspacePageCopy(locale));
let overview = $state<OverviewSignedData | null>(null);
let failed = $state(false);
let retry = $state(0);
let pinError = $state<string | null>(null);
let updatingCatalogLinkSlug = $state<string | null>(null);
const overviewLinkItems = $derived(overview?.overview?.overviewLinks ?? []);

const { calendarTimelineItemsForDay } = createWorkspaceCalendarDisplayActions({
  getCommonCourseLabel: () => workspacePageCopy.common.courses,
  getEventLabels: () => ({
    ...workspacePageCopy.CalendarEventCard,
    noCompletionRequired: workspacePageCopy.homeworks.noCompletionRequired,
  }),
  getTodoPriorityLabel: (priority) =>
    workspacePageCopy.todos.priority[priority as "low" | "medium" | "high"],
  getWeekNumberTemplate: () => workspacePageCopy.sectionDetail.weekNumber,
  tabHref: workspaceTabHref,
});

async function load(
  ownerId: string,
  atTime: string | null,
  previewWeek: string | null,
  requestLocale: AppLocale,
  controller: AbortController,
) {
  try {
    const query = new URLSearchParams();
    if (atTime) query.set("snapshotAt", atTime);
    if (previewWeek) query.set("overviewWeek", previewWeek);
    const search = query.toString();
    const response = await fetch(
      `${HOME_VIEWER_PATH}${search ? `?${search}` : ""}`,
      {
        cache: "no-store",
        headers: { accept: "application/json" },
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error(`overview ${response.status}`);
    const body = (await response.json()) as OverviewSignedData;
    if (controller.signal.aborted || $shellViewer.viewer?.id !== ownerId)
      return;
    if (!body.signedIn || body.navStats?.user.id !== ownerId) {
      failed = true;
      return;
    }
    overview = { ...body, copy: getWorkspacePageCopy(requestLocale) };
  } catch {
    if (!controller.signal.aborted && $shellViewer.viewer?.id === ownerId) {
      failed = true;
    }
  }
}

$effect(() => {
  const ownerId = viewer?.id;
  const atTime = snapshotAt;
  const previewWeek = overviewWeek;
  const requestLocale = locale;
  void retry;
  overview = null;
  failed = false;
  pinError = null;
  updatingCatalogLinkSlug = null;
  if (!browser || !ownerId) return;
  const controller = new AbortController();
  void load(ownerId, atTime, previewWeek, requestLocale, controller);
  return () => controller.abort();
});

async function submitWorkspaceLinkPin(slug: string, action: "pin" | "unpin") {
  const ownerId = viewer?.id;
  if (!ownerId || updatingCatalogLinkSlug) return;
  updatingCatalogLinkSlug = slug;
  pinError = null;
  try {
    const pinnedSlugs = await submitWorkspaceLinkPinRequest({
      action,
      fallbackMessage: workspacePageCopy.workspace.linkHub.pinFailedDescription,
      returnTo: currentCatalogLinkReturnTo(),
      slug,
    });
    if ($shellViewer.viewer?.id !== ownerId || !overview?.overview) return;
    overview = {
      ...overview,
      overview: {
        ...overview.overview,
        overviewLinks: applyCatalogLinkPinnedSlugs(
          overviewLinkItems,
          pinnedSlugs,
        ),
      },
    };
  } catch (error) {
    if ($shellViewer.viewer?.id === ownerId) {
      pinError = error instanceof Error ? error.message : copy.failed;
    }
  } finally {
    if ($shellViewer.viewer?.id === ownerId) updatingCatalogLinkSlug = null;
  }
}
</script>

{#if viewer}
  <section
    aria-label={copy.title}
    aria-busy={!overview && !failed}
    class="grid min-w-0 content-start gap-4"
    data-testid="home-personal-overview"
  >
    {#if failed}
      <Alert.Root>
        <Alert.Description>{copy.failed}</Alert.Description>
        <Button variant="outline" size="sm" onclick={() => { retry += 1; }}>
          {copy.retry}
        </Button>
      </Alert.Root>
    {:else if overview && overview.navStats.user.id === viewer.id}
      {#if pinError}
        <Alert.Root variant="destructive">
          <Alert.Description>{pinError}</Alert.Description>
        </Alert.Root>
      {/if}
      <OverviewTab
        workspaceCopy={workspacePageCopy.workspace}
        subscriptionsCopy={workspacePageCopy.subscriptions}
        signedData={overview}
        {locale}
        {workspaceTabHref}
        {submitWorkspaceLinkPin}
        {linkIconLabel}
        {calendarTimelineItemsForDay}
        {overviewLinkItems}
        {updatingCatalogLinkSlug}
      />
    {:else}
      <div aria-hidden="true" class="grid gap-4" data-testid="home-personal-loading">
        <Skeleton class="h-6 w-24" />
        <Skeleton class="h-20 w-full" />
        <div class="grid gap-4 lg:grid-cols-2">
          <Skeleton class="h-32 w-full" />
          <Skeleton class="h-32 w-full" />
        </div>
      </div>
    {/if}
  </section>
{/if}
