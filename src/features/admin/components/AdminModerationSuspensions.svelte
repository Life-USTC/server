<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";

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
      <Card.Content class="grid gap-3 pt-5">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <Card.Title>{suspension.user.name ?? suspension.user.username ?? suspension.user.id}</Card.Title>
            <p class="text-base-content/60 text-sm">
              {suspension.reason ?? copy.noReason} · {suspension.expiresAt
                ? formatMessage(copy.expiresAt, { date: formatDate(suspension.expiresAt) })
                : copy.permanent}
            </p>
          </div>
          {#if suspension.liftedAt}
            <Badge variant="ghost">{copy.lifted}</Badge>
          {:else}
            <Badge class="border-warning/40 bg-warning/10 text-warning">{copy.active}</Badge>
          {/if}
        </div>
        {#if !suspension.liftedAt}
          <form method="POST" action="?/liftSuspension" use:enhance={enhanceLiftSuspension}>
            <input type="hidden" name="id" value={suspension.id} />
            <Button disabled={isLiftingSuspension} size="sm" type="submit" variant="outline">
              {isLiftingSuspension ? copy.saving : copy.liftSuspensionAction}
            </Button>
          </form>
        {/if}
      </Card.Content>
    </Card.Root>
  {:else}
    <Alert>{copy.noSuspensions}</Alert>
  {/each}
</section>
