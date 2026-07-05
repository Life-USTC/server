<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";

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
  active: string;
  expiresAt: string;
  lifted: string;
  liftSuspensionAction: string;
  noReason: string;
  noSuspensions: string;
  permanent: string;
  saving: string;
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
</script>

<section class="grid gap-3">
  {#each suspensions as suspension}
    <Card.Root>
      <Card.Header>
        <Card.Title>{suspension.user.name ?? suspension.user.username ?? suspension.user.id}</Card.Title>
        <Card.Description>
          {suspension.reason ?? copy.noReason} · {suspension.expiresAt
            ? formatMessage(copy.expiresAt, { date: formatDate(suspension.expiresAt) })
            : copy.permanent}
        </Card.Description>
        <Card.Action>
          {#if suspension.liftedAt}
            <Badge variant="ghost">{copy.lifted}</Badge>
          {:else}
            <Badge variant="destructive">{copy.active}</Badge>
          {/if}
        </Card.Action>
      </Card.Header>
      {#if !suspension.liftedAt}
        <Card.Footer>
          <form method="POST" action="?/liftSuspension" use:enhance={enhanceLiftSuspension}>
            <input type="hidden" name="id" value={suspension.id} />
            <Button disabled={isLiftingSuspension} size="sm" type="submit" variant="outline">
              {#if isLiftingSuspension}
                <Spinner data-icon="inline-start" />
              {/if}
              {isLiftingSuspension ? copy.saving : copy.liftSuspensionAction}
            </Button>
          </form>
        </Card.Footer>
      {/if}
    </Card.Root>
  {:else}
    <Empty.Root class="min-h-24">
      <Empty.Header>
        <Empty.Description>{copy.noSuspensions}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/each}
</section>
