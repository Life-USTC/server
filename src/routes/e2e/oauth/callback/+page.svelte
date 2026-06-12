<script lang="ts">
import { page } from "$app/stores";
import * as Card from "$lib/components/ui/card/index.js";

$: callbackPayload = {
  code: $page.url.searchParams.get("code"),
  state: $page.url.searchParams.get("state"),
  error: $page.url.searchParams.get("error"),
};
$: callbackJson = JSON.stringify(callbackPayload, null, 2);
</script>

<svelte:head><title>OAuth E2E Callback - Life@USTC</title></svelte:head>

<main class="grid gap-4">
  <Card.Root>
    <Card.Header>
      <Card.Title>OAuth E2E Callback</Card.Title>
      <Card.Description>Captured callback parameters for OAuth integration flows.</Card.Description>
    </Card.Header>
    <Card.Content>
      <pre class="overflow-auto rounded-md border bg-muted/30 p-4 text-sm">{callbackJson}</pre>
    </Card.Content>
  </Card.Root>
</main>
