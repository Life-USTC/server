<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardLinkPinSubmit,
  LinkView,
  SignedLinkGroup,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import LinksTab from "./LinksTab.svelte";

export let dashboardCopy: DashboardDashboardCopy;
export let linkActionError: string;
export let linkIconLabel: (icon: string) => string;
export let linkReturnTo: string;
export let linkSearchInput: HTMLInputElement | null;
export let linkSearchQuery: string;
export let linkView: LinkView;
export let setLinkView: (view: LinkView) => void;
export let signedLinkGroups: SignedLinkGroup[];
export let submitDashboardLinkPin: DashboardLinkPinSubmit;
export let updatingDashboardLinkSlug: string | null;
</script>

<LinksTab
  {dashboardCopy}
  {submitDashboardLinkPin}
  {linkIconLabel}
  {setLinkView}
  {linkView}
  {linkReturnTo}
  {linkActionError}
  {updatingDashboardLinkSlug}
  {signedLinkGroups}
  bind:linkSearchQuery
  bind:linkSearchInput
/>
