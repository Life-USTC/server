<script lang="ts">
import { DEMO_EXIT_PATH } from "#lib/auth/demo-request-signal.js";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import type { DemoView } from "@/features/demo/lib/demo-types";

let { demo, locale }: { demo: DemoView; locale: string } = $props();
let referenceTime = $derived(
  new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(demo.referenceNow)),
);
</script>

<Alert.Root class="mb-4" data-testid="demo-notice">
  <Alert.Title>{demo.displayName}</Alert.Title>
  <Alert.Description>
    <p>{demo.readOnlyReason}</p>
    <p id="demo-unavailable">{demo.unavailableReason}</p>
    <p>{demo.referenceTimeLabel}: {referenceTime}</p>
    <form method="POST" action={DEMO_EXIT_PATH}>
      <Button size="sm" type="submit" variant="outline">{demo.exitLabel}</Button>
    </form>
  </Alert.Description>
</Alert.Root>
