<script lang="ts">
import type {
  SignedLinkGroup,
  WorkspaceCopy,
  WorkspaceLinkPinSubmit,
} from "@/features/workspace/lib/workspace-controller-helpers";
import LinksTab from "./LinksTab.svelte";

export let workspaceCopy: WorkspaceCopy;
export let linkActionError: string;
export let linkIconLabel: (icon: string) => string;
export let linkReturnTo: string;
export let linkSearchInput: HTMLInputElement | null;
export let linkSearchQuery: string;
export let signedLinkGroups: SignedLinkGroup[];
export let submitWorkspaceLinkPin: WorkspaceLinkPinSubmit;
export let updatingCatalogLinkSlug: string | null;
</script>

<LinksTab
  {workspaceCopy}
  {submitWorkspaceLinkPin}
  {linkIconLabel}
  {linkReturnTo}
  {linkActionError}
  {updatingCatalogLinkSlug}
  {signedLinkGroups}
  bind:linkSearchQuery
  bind:linkSearchInput
/>
