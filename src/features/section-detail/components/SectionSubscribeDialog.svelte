<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import LinkIcon from "$lib/components/icons/link-2.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";

export let close: () => void;
export let commonCopy: {
  signIn?: string;
};
export let homeworkCopy: {
  cancel: string;
};
export let sectionCopy: {
  loginRequired: string;
  subscribeLabel: string;
  subscribing: string;
  subscriptionDisclaimer: string;
};
export let sectionJwId: number | string;
export let signedIn: boolean;
export let subscriptionAction: (action: "subscribe") => SubmitFunction;
export let subscriptionPendingAction: "subscribe" | "unsubscribe" | null;
</script>

<Dialog.Root
  open={true}
  class="max-w-lg"
  onOpenChange={(open) => {
    if (!open) close();
  }}
  aria-labelledby="section-subscribe-title"
>
  <Dialog.Header>
    <Dialog.Title id="section-subscribe-title">
      {signedIn ? sectionCopy.subscribeLabel : sectionCopy.loginRequired}
    </Dialog.Title>
    <Dialog.Description>
      {sectionCopy.subscriptionDisclaimer}
    </Dialog.Description>
  </Dialog.Header>
  <Dialog.Footer>
    <Button variant="secondary" type="button" onclick={close}>
      {homeworkCopy.cancel}
    </Button>
    {#if signedIn}
      <form
        method="POST"
        action="?/subscribe"
        use:enhance={subscriptionAction("subscribe")}
      >
        <Button type="submit" disabled={subscriptionPendingAction === "subscribe"}>
          <LinkIcon />
          {subscriptionPendingAction === "subscribe"
            ? sectionCopy.subscribing
            : sectionCopy.subscribeLabel}
        </Button>
      </form>
    {:else}
      <Button href={`/signin?callbackUrl=${encodeURIComponent(`/sections/${sectionJwId}`)}`}>
        {commonCopy.signIn ?? ""}
      </Button>
    {/if}
  </Dialog.Footer>
</Dialog.Root>
