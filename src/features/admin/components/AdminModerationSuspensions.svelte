<script lang="ts">
import Unlock from "@lucide/svelte/icons/unlock";
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import TableIconButton from "$lib/components/TableIconButton.svelte";
import TableRowActions from "$lib/components/TableRowActions.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import AdminListShell from "./AdminListShell.svelte";
import AdminTableShell from "./AdminTableShell.svelte";

type ModerationSuspension = {
  expiresAt?: string | Date | null;
  id: string;
  liftedAt?: string | Date | null;
  reason?: string | null;
  user: {
    id: string;
    name?: string | null;
    username?: string | null;
  };
};

type SuspensionsCopy = {
  actions: string;
  active: string;
  cancelButton: string;
  expires: string;
  expiresAt: string;
  liftSuspensionAction: string;
  liftSuspensionConfirmAction: string;
  liftSuspensionConfirmDescription: string;
  liftSuspensionConfirmTitle: string;
  lifted: string;
  noReason: string;
  noSuspensions: string;
  permanent: string;
  reason: string;
  saving: string;
  status: string;
  user: string;
};

export let copy: SuspensionsCopy;
export let enhanceLiftSuspension: (id: string) => SubmitFunction;
export let formatDate: (value: string | Date) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let liftingSuspensionId: string | null;
export let suspensions: ModerationSuspension[];

let pendingLiftSuspension: ModerationSuspension | null = null;

function userLabel(suspension: ModerationSuspension) {
  return suspension.user.name ?? suspension.user.username ?? suspension.user.id;
}

function expiresLabel(suspension: ModerationSuspension) {
  return suspension.expiresAt
    ? formatMessage(copy.expiresAt, {
        date: formatDate(suspension.expiresAt),
      })
    : copy.permanent;
}

function confirmedLiftAction(suspension: ModerationSuspension): SubmitFunction {
  return async (input) => {
    const callback = await enhanceLiftSuspension(suspension.id)(input);
    return async (result) => {
      await callback?.(result);
      if (result.result.type === "success") pendingLiftSuspension = null;
    };
  };
}
</script>

<section class="grid gap-3">
  {#if suspensions.length === 0}
    <Empty.Root class="min-h-20 border-0 px-2 py-6">
      <Empty.Header>
        <Empty.Description>{copy.noSuspensions}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <AdminListShell class="xl:hidden">
      <Item.Group class="gap-0">
      {#each suspensions as suspension, index (suspension.id)}
        <Item.Root class="items-start px-1 py-3">
          <Item.Content class="min-w-0 gap-2">
            {@const currentUserLabel = userLabel(suspension)}
            <Item.Title title={currentUserLabel}>{currentUserLabel}</Item.Title>
            {#if suspension.user.username}
              <Item.Description class="font-mono">
                @{suspension.user.username}
              </Item.Description>
            {/if}
            <Item.Description class="truncate" title={`${suspension.reason ?? copy.noReason} · ${expiresLabel(suspension)}`}>
              {suspension.reason ?? copy.noReason} · {expiresLabel(suspension)}
            </Item.Description>
          </Item.Content>
          <Item.Actions class="flex-wrap items-center gap-2">
            {#if suspension.liftedAt}
              <Badge variant="ghost">{copy.lifted}</Badge>
            {:else}
              <Badge variant="destructive">{copy.active}</Badge>
              <Button
                disabled={Boolean(liftingSuspensionId)}
                aria-label={liftingSuspensionId === suspension.id
                  ? copy.saving
                  : copy.liftSuspensionAction}
                onclick={() => (pendingLiftSuspension = suspension)}
                size="sm"
                type="button"
                variant="ghost"
              >
                {#if liftingSuspensionId === suspension.id}<Spinner data-icon="inline-start" />{:else}<Unlock data-icon="inline-start" />{/if}
                {liftingSuspensionId === suspension.id ? copy.saving : copy.liftSuspensionAction}
              </Button>
            {/if}
          </Item.Actions>
        </Item.Root>
        {#if index < suspensions.length - 1}<Item.Separator class="my-0" />{/if}
      {/each}
      </Item.Group>
    </AdminListShell>

    <div class="hidden min-w-0 xl:block">
      <AdminTableShell label={copy.user}>
        <Table.Root class="w-full min-w-[54rem]">
        <Table.Header>
          <Table.Row>
            <Table.Head class="w-[23%]">{copy.user}</Table.Head>
            <Table.Head class="w-[34%]">{copy.reason}</Table.Head>
            <Table.Head class="w-[20%] text-right">{copy.expires}</Table.Head>
            <Table.Head class="w-[13%] text-center">{copy.status}</Table.Head>
            <Table.Head class="w-14 min-w-14 text-right">
              <span class="sr-only">{copy.actions}</span>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each suspensions as suspension}
            <Table.Row class="group">
              <Table.Cell class="max-w-0">
                {@const currentUserLabel = userLabel(suspension)}
                <div class="grid min-w-0 gap-0.5">
                  <span class="block max-w-full" title={currentUserLabel}>
                    <TruncatedText class="font-medium" text={currentUserLabel} />
                  </span>
                  {#if suspension.user.username}
                    <span class="font-mono text-muted-foreground text-xs">
                      @{suspension.user.username}
                    </span>
                  {/if}
                </div>
              </Table.Cell>
              <Table.Cell class="max-w-0">
                <TruncatedText
                  lines={2}
                  text={suspension.reason ?? copy.noReason}
                />
              </Table.Cell>
              <Table.Cell class="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                {expiresLabel(suspension)}
              </Table.Cell>
              <Table.Cell class="text-center">
                {#if suspension.liftedAt}
                  <Badge variant="ghost">{copy.lifted}</Badge>
                {:else}
                  <Badge variant="destructive">{copy.active}</Badge>
                {/if}
              </Table.Cell>
              <Table.Cell class="w-14 min-w-14 text-right">
                {#if !suspension.liftedAt}
                  <TableRowActions class="justify-end">
                  <TableIconButton
                      disabled={Boolean(liftingSuspensionId)}
                      label={liftingSuspensionId === suspension.id
                        ? copy.saving
                        : copy.liftSuspensionAction}
                      onclick={() => (pendingLiftSuspension = suspension)}
                    >
                      {#if liftingSuspensionId === suspension.id}<Spinner />{:else}<Unlock />{/if}
                  </TableIconButton>
                  </TableRowActions>
                {/if}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
        </Table.Root>
      </AdminTableShell>
    </div>
  {/if}
</section>

{#if pendingLiftSuspension}
  <AlertDialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open && !liftingSuspensionId) pendingLiftSuspension = null;
    }}
  >
    <AlertDialog.Content class="max-w-md sm:max-w-md">
      <AlertDialog.Header>
        <AlertDialog.Title>{copy.liftSuspensionConfirmTitle}</AlertDialog.Title>
        <AlertDialog.Description>
          {formatMessage(copy.liftSuspensionConfirmDescription, {
            user: userLabel(pendingLiftSuspension),
          })}
        </AlertDialog.Description>
      </AlertDialog.Header>
      <form
        method="POST"
        action="?/liftSuspension"
        use:enhance={confirmedLiftAction(pendingLiftSuspension)}
      >
        <input type="hidden" name="id" value={pendingLiftSuspension.id} />
        <AlertDialog.Footer>
          <AlertDialog.Cancel
            type="button"
            disabled={Boolean(liftingSuspensionId)}
            variant="outline"
          >
            {copy.cancelButton}
          </AlertDialog.Cancel>
          <AlertDialog.Action
            type="submit"
            disabled={Boolean(liftingSuspensionId)}
            variant="destructive"
          >
            {#if liftingSuspensionId === pendingLiftSuspension.id}
              <Spinner data-icon="inline-start" />
            {:else}
              <Unlock data-icon="inline-start" />
            {/if}
            {copy.liftSuspensionConfirmAction}
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </form>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
