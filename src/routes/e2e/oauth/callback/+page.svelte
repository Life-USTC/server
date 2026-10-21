<script lang="ts">
import * as Card from "#lib/components/ui/card/index.js";
import { page as routePage } from "$app/state";

let callbackPayload = $derived({
  code: routePage.url.searchParams.get("code"),
  state: routePage.url.searchParams.get("state"),
  error: routePage.url.searchParams.get("error"),
});
let callbackJson = $derived(JSON.stringify(callbackPayload, null, 2));
</script>

<svelte:head><title>OAuth E2E Callback - Life@USTC</title></svelte:head>

<div class="grid gap-4">
  <Card.Root>
    <Card.Header>
      <Card.Title>
        <h1>OAuth E2E Callback</h1>
      </Card.Title>
      <Card.Description>Captured callback parameters for OAuth integration flows.</Card.Description>
    </Card.Header>
    <Card.Content>
      <pre class="overflow-auto rounded-md border bg-muted/30 p-4 text-sm">{callbackJson}</pre>
    </Card.Content>
  </Card.Root>
</div>
