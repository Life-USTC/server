<script lang="ts">
import XIcon from "@lucide/svelte/icons/x";
import SearchField from "#lib/components/SearchField.svelte";
import { toolbarControlClass } from "#lib/components/toolbar-control.js";
import { Button } from "#lib/components/ui/button/index.js";
import type { AdminUsersCommonCopy, AdminUsersCopy } from "./admin-user-types";

export let commonCopy: AdminUsersCommonCopy;
export let copy: AdminUsersCopy;
export let values: Record<string, string>;
export let onchange: (patch: Record<string, string>) => void;
export let onapply: (event: SubmitEvent) => void;
export let id: string;
</script>

    <form id={`${id}-form`} onsubmit={onapply} class="flex min-w-0 basis-full flex-wrap items-center gap-2">
      <SearchField {id} name="search" label={commonCopy.search} placeholder={copy.searchPlaceholder} value={values.search ?? ""} oninput={(event) => onchange({ search: event.currentTarget.value })} />
      {#if Object.values(values).some(Boolean)}
        <Button href="/admin/users" variant="outline" class={toolbarControlClass}>
          <XIcon data-icon="inline-start" />
          {commonCopy.clear}
        </Button>
      {/if}
      <Button type="submit" class={toolbarControlClass}>{commonCopy.applyFilters}</Button>
    </form>
