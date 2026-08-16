<script lang="ts">
import Unlock from "@lucide/svelte/icons/unlock";
import type { SubmitFunction } from "@sveltejs/kit";
import DashboardTableIconButton from "@/features/dashboard/components/DashboardTableIconButton.svelte";
import DashboardTableRowActions from "@/features/dashboard/components/DashboardTableRowActions.svelte";
import { enhance } from "$app/forms";
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import * as Table from "$lib/components/ui/table/index.js";

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
    <SoftEmptyMessage message={copy.noSuspensions} />
  {:else}
    <Item.Group class="xl:hidden">
      {#each suspensions as suspension}
        <Item.Root variant="outline" class="items-start">
          <Item.Content class="min-w-0 gap-2">
            <Item.Title>{userLabel(suspension)}</Item.Title>
            {#if suspension.user.username}
              <Item.Description class="font-mono">
                @{suspension.user.username}
              </Item.Description>
            {/if}
            <Item.Description>
              {suspension.reason ?? copy.noReason} · {expiresLabel(suspension)}
            </Item.Description>
          </Item.Content>
          <Item.Actions class="items-center gap-2">
            {#if suspension.liftedAt}
              <Badge variant="ghost">{copy.lifted}</Badge>
            {:else}
              <Badge variant="destructive">{copy.active}</Badge>
              <DashboardTableIconButton
                disabled={Boolean(liftingSuspensionId)}
                label={liftingSuspensionId === suspension.id
                  ? copy.saving
                  : copy.liftSuspensionAction}
                onclick={() => (pendingLiftSuspension = suspension)}
              >
                {#if liftingSuspensionId === suspension.id}<Spinner />{:else}<Unlock />{/if}
              </DashboardTableIconButton>
            {/if}
          </Item.Actions>
        </Item.Root>
      {/each}
    </Item.Group>

    <div class="hidden min-w-0 xl:block">
      <Table.Root class="w-full">
        <Table.Header>
          <Table.Row>
            <Table.Head>{copy.user}</Table.Head>
            <Table.Head>{copy.reason}</Table.Head>
            <Table.Head class="text-right">{copy.expires}</Table.Head>
            <Table.Head class="text-center">{copy.status}</Table.Head>
            <Table.Head class="w-12 text-right">
              <span class="sr-only">{copy.actions}</span>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each suspensions as suspension}
            <Table.Row class="group">
              <Table.Cell>
                <div class="grid min-w-0 gap-0.5">
                  <TruncatedText class="font-medium" text={userLabel(suspension)} />
                  {#if suspension.user.username}
                    <span class="font-mono text-muted-foreground text-xs">
                      @{suspension.user.username}
                    </span>
                  {/if}
                </div>
              </Table.Cell>
              <Table.Cell>
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
              <Table.Cell class="w-12 text-right">
                {#if !suspension.liftedAt}
                  <DashboardTableRowActions class="justify-end">
                    <DashboardTableIconButton
                      disabled={Boolean(liftingSuspensionId)}
                      label={liftingSuspensionId === suspension.id
                        ? copy.saving
                        : copy.liftSuspensionAction}
                      onclick={() => (pendingLiftSuspension = suspension)}
                    >
                      {#if liftingSuspensionId === suspension.id}<Spinner />{:else}<Unlock />{/if}
                    </DashboardTableIconButton>
                  </DashboardTableRowActions>
                {/if}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
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
          <Button
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
          </Button>
        </AlertDialog.Footer>
      </form>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}
