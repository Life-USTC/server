<script lang="ts">
import type { AppLocale } from "@/i18n/config";
import { getOAuthCopy } from "@/lib/oauth-copy";
import { page } from "$app/stores";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";

$: copy = getOAuthCopy(($page.data.locale ?? "zh-cn") as AppLocale);
$: errorCode = $page.url.searchParams.get("error");
$: message =
  errorCode === "consent_failed" ? copy.errorConsentFailed : copy.errorGeneric;
</script>

<svelte:head><title>{copy.errorPageTitle} - Life@USTC</title></svelte:head>

<main class="grid min-h-[calc(100vh-8rem)] place-items-center px-4">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center">
      <Card.Title class="text-2xl">{copy.errorPageTitle}</Card.Title>
      <Card.Description>{message}</Card.Description>
    </Card.Header>
    <Card.Content class="grid justify-items-center gap-4 text-center text-base-content/60 text-sm">
      <p>
        {copy.errorPageHint}
      </p>
      <Button href="/" variant="outline">{copy.returnHome}</Button>
    </Card.Content>
  </Card.Root>
</main>
