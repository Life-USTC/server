<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardLinkPinSubmit,
  LinkView,
  SignedLinkGroup,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import LinksTabGroup from "./LinksTabGroup.svelte";
import LinksTabToolbar from "./LinksTabToolbar.svelte";

export let dashboardCopy: DashboardDashboardCopy;
export let submitDashboardLinkPin: DashboardLinkPinSubmit;
export let linkIconLabel: (icon: string) => string;
export let setLinkView: (view: LinkView) => void;

export let linkSearchQuery: string;
export let linkView: LinkView;
export let linkSearchInput: HTMLInputElement | null;
export let linkReturnTo: string;
export let linkActionError: string;
export let updatingDashboardLinkSlug: string | null;
export let signedLinkGroups: SignedLinkGroup[];
</script>

      <section class="grid gap-4">
        <LinksTabToolbar
          {dashboardCopy}
          bind:linkSearchInput
          bind:linkSearchQuery
          {linkView}
          {setLinkView}
        />

        {#each signedLinkGroups as entry}
          <LinksTabGroup
            {dashboardCopy}
            {entry}
            {linkIconLabel}
            {linkReturnTo}
            {linkView}
            {submitDashboardLinkPin}
            {updatingDashboardLinkSlug}
          />
        {:else}
          <Alert>{dashboardCopy.linkHub.empty}</Alert>
        {/each}

        {#if linkActionError}
          <Alert variant="destructive">
            <span>{dashboardCopy.linkHub.pinFailedTitle}: {linkActionError}</span>
          </Alert>
        {/if}

        <p class="text-base-content/60 text-xs">
          {dashboardCopy.linkHub.credit}
          <Button
            class="h-auto p-0 text-xs"
            href="https://github.com/SmartHypercube/ustclife"
            rel="noreferrer"
            target="_blank"
            variant="link"
          >
            SmartHypercube/ustclife
          </Button>{dashboardCopy.linkHub.creditSuffix}
        </p>
      </section>
