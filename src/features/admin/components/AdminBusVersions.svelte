<script lang="ts">
import AdminBusVersionsMobileList from "@/features/admin/components/AdminBusVersionsMobileList.svelte";
import AdminBusVersionsTable from "@/features/admin/components/AdminBusVersionsTable.svelte";
import * as Card from "$lib/components/ui/card/index.js";
import type {
  AdminBusCopy,
  AdminBusEnhancedAction,
  AdminBusVersion,
  AdminBusVersionFormatter,
} from "./admin-bus-types";

export let copy: AdminBusCopy;
export let enhancedAction: AdminBusEnhancedAction;
export let formatEffectiveRange: AdminBusVersionFormatter;
export let formatImportedAt: (value: string | Date) => string;
export let isPending: (actionKey: string) => boolean;
export let onDelete: (version: AdminBusVersion) => void;
export let pendingAction: string | null;
export let versions: AdminBusVersion[];
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>{copy.versionsTitle}</Card.Title>
    <Card.Description>
      {copy.versionsDescription}
    </Card.Description>
  </Card.Header>
  <Card.Content class="grid gap-4">
    <AdminBusVersionsMobileList
      {copy}
      {enhancedAction}
      {formatEffectiveRange}
      {formatImportedAt}
      {isPending}
      {onDelete}
      {pendingAction}
      {versions}
    />

    <AdminBusVersionsTable
      {copy}
      {enhancedAction}
      {formatEffectiveRange}
      {formatImportedAt}
      {isPending}
      {onDelete}
      {pendingAction}
      {versions}
    />
  </Card.Content>
</Card.Root>
