<script lang="ts">
import EndlessScroll from "#lib/components/EndlessScroll.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import type { EndlessScrollState } from "@/lib/navigation/endless-list.svelte";
import { tableFilterPageHref } from "@/lib/table-filter-query";
import { goto } from "$app/navigation";
import AdminUsersHeader from "./AdminUsersHeader.svelte";
import AdminUsersTableCard from "./AdminUsersTableCard.svelte";
import AdminWorkspace from "./AdminWorkspace.svelte";
import type {
  AdminUserFormatter,
  AdminUserRow,
  AdminUsersAdminCopy,
  AdminUsersCommonCopy,
  AdminUsersFilters,
  AdminUsersPageCopy,
} from "./admin-user-types";

export let adminCopy: AdminUsersAdminCopy;
export let commonCopy: AdminUsersCommonCopy;
export let copy: AdminUsersPageCopy;
export let displayName: AdminUserFormatter;
export let filters: AdminUsersFilters;
export let formatDate: (value: Date | string | null | undefined) => string;
export let message: string | null;
export let messageVariant: "destructive" | "default";
export let onSelect: (user: AdminUserRow) => void;
export let endless: EndlessScrollState;
export let suspensionLabel: AdminUserFormatter;
export let users: AdminUserRow[];
let draft: Record<string, string> = {};
$: draft = { ...filters };
function change(patch: Record<string, string>) {
  draft = { ...draft, ...patch };
}
function apply(event: SubmitEvent) {
  event.preventDefault();
  void goto(tableFilterPageHref("/admin/users", draft));
}
</script>

<AdminWorkspace>
  {#snippet header()}
    <AdminUsersHeader
      {adminCopy}
      {copy}
      search={filters.search ?? ""}
    />
  {/snippet}
  {#snippet feedback()}
    {#if message && messageVariant === "destructive"}<Alert.Root variant={messageVariant}><Alert.Description>{message}</Alert.Description></Alert.Root>{/if}
  {/snippet}
  <AdminUsersTableCard
    {commonCopy}
    values={draft}
    onchange={change}
    onapply={apply}
    {copy}
    {displayName}
    {formatDate}
    {onSelect}
    {suspensionLabel}
    {users}
  />

  <EndlessScroll state={endless} labels={commonCopy.endlessScroll} />
</AdminWorkspace>
