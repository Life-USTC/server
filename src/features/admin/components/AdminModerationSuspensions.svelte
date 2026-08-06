<script lang="ts">
import Unlock from "@lucide/svelte/icons/unlock";
import type { SubmitFunction } from "@sveltejs/kit";
import DashboardTableIconButton from "@/features/dashboard/components/DashboardTableIconButton.svelte";
import DashboardTableRowActions from "@/features/dashboard/components/DashboardTableRowActions.svelte";
import { enhance } from "$app/forms";
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
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
  expires: string;
  expiresAt: string;
  liftSuspensionAction: string;
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
export let enhanceLiftSuspension: SubmitFunction;
export let formatDate: (value: string | Date) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let isLiftingSuspension: boolean;
export let suspensions: ModerationSuspension[];

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
</script>

<section class="grid gap-3">
  {#if suspensions.length === 0}
    <SoftEmptyMessage message={copy.noSuspensions} />
  {:else}
    <Item.Group class="md:hidden">
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
              <form
                method="POST"
                action="?/liftSuspension"
                use:enhance={enhanceLiftSuspension}
              >
                <input type="hidden" name="id" value={suspension.id} />
                <DashboardTableIconButton
                  disabled={isLiftingSuspension}
                  label={isLiftingSuspension
                    ? copy.saving
                    : copy.liftSuspensionAction}
                  type="submit"
                >
                  {#if isLiftingSuspension}
                    <Spinner />
                  {:else}
                    <Unlock />
                  {/if}
                </DashboardTableIconButton>
              </form>
            {/if}
          </Item.Actions>
        </Item.Root>
      {/each}
    </Item.Group>

    <div class="hidden min-w-0 md:block">
      <Table.Root class="w-full">
        <Table.Header>
          <Table.Row>
            <Table.Head>{copy.user}</Table.Head>
            <Table.Head>{copy.reason}</Table.Head>
            <Table.Head>{copy.expires}</Table.Head>
            <Table.Head>{copy.status}</Table.Head>
            <Table.Head>
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
              <Table.Cell class="whitespace-nowrap text-muted-foreground">
                {expiresLabel(suspension)}
              </Table.Cell>
              <Table.Cell>
                {#if suspension.liftedAt}
                  <Badge variant="ghost">{copy.lifted}</Badge>
                {:else}
                  <Badge variant="destructive">{copy.active}</Badge>
                {/if}
              </Table.Cell>
              <Table.Cell>
                {#if !suspension.liftedAt}
                  <DashboardTableRowActions>
                    <form
                      method="POST"
                      action="?/liftSuspension"
                      use:enhance={enhanceLiftSuspension}
                    >
                      <input type="hidden" name="id" value={suspension.id} />
                      <DashboardTableIconButton
                        disabled={isLiftingSuspension}
                        label={isLiftingSuspension
                          ? copy.saving
                          : copy.liftSuspensionAction}
                        type="submit"
                      >
                        {#if isLiftingSuspension}
                          <Spinner />
                        {:else}
                          <Unlock />
                        {/if}
                      </DashboardTableIconButton>
                    </form>
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
