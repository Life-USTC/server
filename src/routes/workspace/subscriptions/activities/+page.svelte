<script lang="ts">
import YoungActivityRemindersPage from "@/features/young/components/YoungActivityRemindersPage.svelte";
import { createEndlessList } from "@/lib/navigation/endless-list.svelte";
import { page } from "$app/state";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
type EventRow = NonNullable<PageData["events"]>["data"][number];
type OrganizerRow = NonNullable<PageData["organizers"]>["data"][number];
type NotificationRow = NonNullable<PageData["notifications"]>["data"][number];
type ActivityRow = EventRow | OrganizerRow | NotificationRow;
const feed = createEndlessList<PageData, ActivityRow>({
  source: () => data,
  select: (value) => {
    const result = value.events ?? value.organizers ?? value.notifications;
    return {
      items: result?.data ?? [],
      page: result?.pagination.page ?? 1,
      totalPages: result?.pagination.totalPages ?? 1,
    };
  },
  key: (row) =>
    "id" in row ? row.id : "youngId" in row ? row.youngId : row.organizerId,
  pageHref: (next) => {
    const query = new URLSearchParams(page.url.search);
    query.set("page", String(next));
    return `${page.url.pathname}?${query}`;
  },
});
const listData = $derived({
  ...data,
  events: data.events
    ? { ...data.events, data: feed.items as EventRow[] }
    : null,
  organizers: data.organizers
    ? { ...data.organizers, data: feed.items as OrganizerRow[] }
    : null,
  notifications: data.notifications
    ? { ...data.notifications, data: feed.items as NotificationRow[] }
    : null,
});
</script>

<YoungActivityRemindersPage data={listData} endless={feed} />
