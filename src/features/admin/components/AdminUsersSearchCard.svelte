<script lang="ts">
import XIcon from "@lucide/svelte/icons/x";
import FilterToolbar from "$lib/components/FilterToolbar.svelte";
import SearchField from "$lib/components/SearchField.svelte";
import { toolbarControlClass } from "$lib/components/toolbar-control";
import { Button } from "$lib/components/ui/button/index.js";
import type { AdminUsersCommonCopy, AdminUsersCopy } from "./admin-user-types";

export let commonCopy: AdminUsersCommonCopy;
export let copy: AdminUsersCopy;
export let search: string;
</script>

<FilterToolbar>
  {#snippet primary()}
    <form method="GET" class="flex min-w-0 flex-wrap items-center gap-2">
      <SearchField id="admin-user-search" name="search" label={commonCopy.search} placeholder={copy.searchPlaceholder} value={search} />
      {#if search}
        <Button href="/admin/users" variant="outline" class={toolbarControlClass}>
          <XIcon data-icon="inline-start" />
          {commonCopy.clear}
        </Button>
      {/if}
      <Button type="submit" class={toolbarControlClass}>{commonCopy.search}</Button>
    </form>
  {/snippet}
</FilterToolbar>
