<script lang="ts">
import Unlock from "@lucide/svelte/icons/unlock";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TableRowActions from "#lib/components/TableRowActions.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import { Spinner } from "#lib/components/ui/spinner/index.js";
import Table from "#lib/components/ui/table/table.svelte";
import { enhance, type SubmitFunction } from "$app/forms";
import type { AdminModerationFilterControls } from "./admin-moderation-page-types";
import ModerationCollection from "./ModerationCollection.svelte";

type ModerationSuspension = {
  expiresAt?: string | Date | null;
  id: string;
  liftedAt?: string | Date | null;
  reason?: string | null;
  user: { id: string; name?: string | null; username?: string | null };
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

export let filterControls: AdminModerationFilterControls;
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
  <ModerationCollection
    {filterControls}
    items={suspensions}
    label={copy.user}
    emptyDescription={copy.noSuspensions}
    fields={["search", "author", "reason", "expiresAt", "status"]}
  >
    {#snippet card(suspension: ModerationSuspension)}
      <Item.Content class="min-w-0 gap-2">
        {@const currentUserLabel = userLabel(suspension)}
        <Item.Title title={currentUserLabel}>{currentUserLabel}</Item.Title>
        {#if suspension.user.username}
        <Item.Description class="font-mono">
          @{suspension.user.username}
        </Item.Description>
        {/if}
      <Item.Description title={`${suspension.reason ?? copy.noReason} · ${expiresLabel(suspension)}`}>
        <TruncatedText text={`${suspension.reason ?? copy.noReason} · ${expiresLabel(suspension)}`} />
      </Item.Description>
      </Item.Content>
      <Item.Actions class="flex-wrap items-center gap-2">
        {#if suspension.liftedAt}
          <Badge variant="ghost">{copy.lifted}</Badge>
        {:else}
          <Badge variant="destructive">{copy.active}</Badge>
          <Button
            disabled={Boolean(liftingSuspensionId)}
            aria-label={liftingSuspensionId === suspension.id ? copy.saving : copy.liftSuspensionAction}
            onclick={() => pendingLiftSuspension = suspension}
            size="sm"
            type="button"
            variant="ghost"
          >
          {#if liftingSuspensionId === suspension.id}<Spinner data-icon="inline-start" />{:else}<Unlock data-icon="inline-start" />{/if}
            {liftingSuspensionId === suspension.id ? copy.saving : copy.liftSuspensionAction}
          </Button>
        {/if}
      </Item.Actions>
    {/snippet}
    {#snippet desktop(emptyState)}
      <Table class="w-full min-w-[54rem]">
        <thead>
          <TableControlsRow colspan={5}>{@render filterControls("search", "desktop")}</TableControlsRow>
          <tr>
            <th class="w-[23%]">{@render filterControls("author", "desktop")}</th>
            <th class="w-[34%]">{@render filterControls("reason", "desktop")}</th>
            <th class="w-[20%]">{@render filterControls("expiresAt", "desktop")}</th>
            <th class="w-[13%]">{@render filterControls("status", "desktop")}</th>
          <th class="w-14 min-w-14">
            <span class="sr-only">{copy.actions}</span>
          </th>
          </tr>
        </thead>
        <tbody>
          {#each suspensions as suspension}
            {@const currentUserLabel = userLabel(suspension)}
            <tr class="group">
              <td class="max-w-0">
                <div class="grid min-w-0 gap-0.5">
                <span class="block max-w-full" title={currentUserLabel}>
                  <TruncatedText class="font-medium" text={currentUserLabel} />
                </span>
                  <TruncatedText
                    class="font-mono text-muted-foreground text-xs"
                    text={suspension.user.username ? `@${suspension.user.username}` : null}
                  />
                </div>
              </td>
              <td class="max-w-0">
                <TruncatedText
                  lines={2}
                  text={suspension.reason ?? copy.noReason}
                />
              </td>
            <td class="whitespace-nowrap text-left tabular-nums text-muted-foreground">
              {expiresLabel(suspension)}
            </td>
              <td class="text-left">
                {#if suspension.liftedAt}
                  <Badge variant="ghost">{copy.lifted}</Badge>
          {:else}
            <Badge variant="destructive">{copy.active}</Badge>
          {/if}
        </td>
        <td class="w-14 min-w-14 text-left">
          {#if !suspension.liftedAt}
            <TableRowActions>
              <TableIconButton
                disabled={Boolean(liftingSuspensionId)}
                label={liftingSuspensionId === suspension.id ? copy.saving : copy.liftSuspensionAction}
                onclick={() => pendingLiftSuspension = suspension}
              >
              {#if liftingSuspensionId === suspension.id}<Spinner />{:else}<Unlock />{/if}
              </TableIconButton>
            </TableRowActions>
          {/if}
        </td>
      </tr>
          {:else}
            <tr><td colspan={5}>{@render emptyState()}</td></tr>
          {/each}
        </tbody>
      </Table>
    {/snippet}
  </ModerationCollection>
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
