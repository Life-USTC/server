<script lang="ts">
import AdminUsersPageController from "@/features/admin/components/AdminUsersPageController.svelte";
import type { AdminUserRow } from "@/features/admin/components/admin-user-types";
import { createEndlessList } from "@/lib/navigation/endless-list.svelte";
import { tableFilterPageHref } from "@/lib/table-filter-query";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
const feed = createEndlessList<PageData, AdminUserRow>({
  source: () => data,
  select: (value) => ({ items: value.users, ...value.pagination }),
  key: (row) => row.id,
  pageHref: (next) => tableFilterPageHref("/admin/users", data.filters, next),
});
</script>

<AdminUsersPageController {data} loadedUsers={feed.items} endless={feed} onUserUpdate={feed.updateItem} />
