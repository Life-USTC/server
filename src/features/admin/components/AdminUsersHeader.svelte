<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import type { AdminUsersAdminCopy, AdminUsersCopy } from "./admin-user-types";

export let adminCopy: AdminUsersAdminCopy;
export let copy: AdminUsersCopy;
export let search: string;
</script>

<PageHeader title={copy.title} description={copy.subtitle} eyebrow={adminCopy.title}>
  {#snippet meta()}
    <div class="flex items-center gap-2 text-sm">
      <span class="text-muted-foreground">{copy.currentFilter}</span>
      <Badge variant="secondary">{search || copy.allUsers}</Badge>
    </div>
  {/snippet}
</PageHeader>
