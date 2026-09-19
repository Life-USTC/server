<script lang="ts">
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import type { WelcomeCopy } from "./welcome-component-types";

export let callbackUrl: string;
export let oauthProviders: Array<{ id: string; name: string }>;
export let oauthRefreshed: boolean;
export let welcomeCopy: WelcomeCopy;
</script>

{#if oauthProviders.length > 0}
  <Card.Root>
    <Card.Header>
      <Card.Title>{welcomeCopy.oauthRefreshTitle}</Card.Title>
      <Card.Description>{welcomeCopy.oauthRefreshDescription}</Card.Description>
    </Card.Header>
    <Card.Content class="grid gap-3">
      {#if oauthRefreshed}
        <Alert.Root>
          <Alert.Description>{welcomeCopy.oauthRefreshSuccess}</Alert.Description>
        </Alert.Root>
      {/if}
      <div class="grid gap-2 sm:grid-cols-2">
        {#each oauthProviders as provider}
          <form method="POST" action="?/refreshOAuth">
            <input type="hidden" name="providerId" value={provider.id} />
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <Button class="w-full justify-start" type="submit" variant="outline">
              <RefreshCw data-icon="inline-start" />
              {welcomeCopy.oauthRefreshAction.replace("{provider}", provider.name)}
            </Button>
          </form>
        {/each}
      </div>
    </Card.Content>
  </Card.Root>
{/if}
