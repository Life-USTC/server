<script lang="ts">
import Unlock from "@lucide/svelte/icons/unlock";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionTableShell from "#lib/components/CollectionTableShell.svelte";
import TableControlsRow from "#lib/components/TableControlsRow.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TableRowActions from "#lib/components/TableRowActions.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Spinner } from "#lib/components/ui/spinner/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import { enhance, type SubmitFunction } from "$app/forms";
import type { AdminModerationFilterControls } from "./admin-moderation-page-types";

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
  <CollectionTableShell cards label={copy.user}>
    <Table.Root class="w-full min-w-[54rem]">
      <Table.Header>
        <TableControlsRow colspan={5}>{@render filterControls("search")}</TableControlsRow>
        <Table.Row>
          <Table.Head class="w-[23%]">{@render filterControls("author")}</Table.Head>
          <Table.Head class="w-[34%]">{@render filterControls("reason")}</Table.Head>
          <Table.Head class="w-[20%]">{@render filterControls("expiresAt")}</Table.Head>
          <Table.Head class="w-[13%]">{@render filterControls("status")}</Table.Head>
        <Table.Head class="w-14 min-w-14">
          <span class="sr-only">{copy.actions}</span>
        </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each suspensions as suspension}
          <Table.Row class="group">
            <Table.Cell data-label={copy.user} class="max-w-0">
              {@const currentUserLabel = userLabel(suspension)}
              <div class="grid min-w-0 gap-0.5">
              <TruncatedText class="font-medium" text={currentUserLabel} />
                <TruncatedText
                  class="font-mono text-muted-foreground text-xs"
                  text={suspension.user.username ? `@${suspension.user.username}` : null}
                />
              </div>
            </Table.Cell>
            <Table.Cell data-label={copy.reason} class="max-w-0">
              <TruncatedText
                lines={2}
                text={suspension.reason ?? copy.noReason}
              />
            </Table.Cell>
          <Table.Cell data-label={copy.expires} class="whitespace-nowrap tabular-nums text-muted-foreground">
            {expiresLabel(suspension)}
          </Table.Cell>
            <Table.Cell data-label={copy.status}>
              {#if suspension.liftedAt}
                <Badge variant="ghost">{copy.lifted}</Badge>
              {:else}
                <Badge variant="destructive">{copy.active}</Badge>
              {/if}
            </Table.Cell>
            <Table.Cell>
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
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row><Table.Cell colspan={5}><CollectionEmpty variant="compact" description={copy.noSuspensions} /></Table.Cell></Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </CollectionTableShell>
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
