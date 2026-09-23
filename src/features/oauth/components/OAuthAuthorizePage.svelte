<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import * as Card from "$lib/components/ui/card/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import OAuthAuthorizeConsentPanel from "./OAuthAuthorizeConsentPanel.svelte";
import OAuthAuthorizeErrorPanel from "./OAuthAuthorizeErrorPanel.svelte";
import OAuthAuthorizeSidePanel from "./OAuthAuthorizeSidePanel.svelte";

type PageData = {
  clientHost?: string;
  clientName?: string;
  copy?: Record<string, string>;
  hint?: string;
  locale?: string;
  message?: string;
  oauthQuery?: string;
  redirectHost?: string;
  redirectIsLoopback?: boolean;
  scope?: string;
  scopes?: Array<{ label: string; value: string }>;
  state: string;
  title?: string;
};

export let data: PageData;

$: appName = data.state === "consent" ? (data.clientName ?? "OAuth") : "OAuth";
$: pageTitle =
  data.state === "error"
    ? (data.title ?? "OAuth")
    : (data.copy?.title ?? "OAuth");
$: pageDescription =
  data.state === "error" ? "" : (data.copy?.description ?? "");
</script>

<svelte:head><title>{pageTitle} - Life@USTC</title></svelte:head>

<section class="mx-auto grid min-h-[calc(100vh-14rem)] w-full max-w-2xl place-items-center px-4 py-10">
  <Card.Root class="w-full">
    <Card.Header class="gap-5 p-6">
      <OAuthAuthorizeSidePanel
        {appName}
        clientHost={data.clientHost}
        clientHostLabel={data.copy?.clientHostLabel}
        redirectHost={data.redirectHost}
        redirectHostLabel={data.copy?.redirectHostLabel}
        redirectIsLoopback={data.redirectIsLoopback ?? false}
        loopbackRedirectWarning={data.copy?.loopbackRedirectWarning}
      />
      <PageHeader
        class="py-0"
        title={pageTitle}
        titleClass="text-2xl"
        description={pageDescription}
      />
    </Card.Header>
    <Separator />
    <Card.Content class="grid gap-5 p-6">
      {#if data.state === "error"}
        <OAuthAuthorizeErrorPanel
          hint={data.hint}
          message={data.message ?? ""}
        />
      {:else if data.copy}
        <OAuthAuthorizeConsentPanel
          copy={data.copy}
          locale={data.locale ?? "zh-cn"}
          oauthQuery={data.oauthQuery ?? ""}
          scope={data.scope ?? ""}
          scopes={data.scopes ?? []}
        />
      {/if}
    </Card.Content>
  </Card.Root>
</section>
