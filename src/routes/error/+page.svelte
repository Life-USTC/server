<script lang="ts">
import { Button } from "#lib/components/ui/button/index.js";
import * as Card from "#lib/components/ui/card/index.js";
import { getOAuthCopy } from "@/features/oauth/lib/oauth-copy";
import type { AppLocale } from "@/i18n/config";
import { page as routePage } from "$app/state";

let copy = $derived(
  getOAuthCopy((routePage.data.locale ?? "zh-cn") as AppLocale),
);
let errorCode = $derived(routePage.url.searchParams.get("error"));
let message = $derived(
  errorCode === "consent_failed"
    ? copy.errorConsentFailed
    : errorCode === "recent_auth_required"
      ? copy.errorRecentAuthRequired
      : copy.errorGeneric,
);
</script>

<svelte:head><title>{copy.errorPageTitle} - Life@USTC</title></svelte:head>

<div class="grid min-h-[calc(100dvh-8rem)] place-items-center">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center">
      <Card.Title>
        <h1>{copy.errorPageTitle}</h1>
      </Card.Title>
      <Card.Description>{message}</Card.Description>
    </Card.Header>
    <Card.Content class="grid justify-items-center gap-4 text-center">
      <p>
        {copy.errorPageHint}
      </p>
      <Button href="/" variant="outline">{copy.returnHome}</Button>
    </Card.Content>
  </Card.Root>
</div>
