<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import * as Card from "$lib/components/ui/card/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import OAuthAuthorizeConsentPanel from "./OAuthAuthorizeConsentPanel.svelte";
import OAuthAuthorizeErrorPanel from "./OAuthAuthorizeErrorPanel.svelte";
import OAuthAuthorizeSidePanel from "./OAuthAuthorizeSidePanel.svelte";

type OAuthAuthorizeCopy = {
  description: string;
  scopesLabel: string;
  title: string;
};

type PageData = {
  clientName?: string;
  copy?: OAuthAuthorizeCopy;
  message?: string;
  oauthQuery?: string;
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
  data.state === "error"
    ? (data.message ?? "")
    : (data.copy?.description ?? "");
</script>

<svelte:head><title>{pageTitle} - Life@USTC</title></svelte:head>

<section class="mx-auto grid min-h-[calc(100vh-14rem)] w-full max-w-2xl place-items-center px-4 py-10">
  <Card.Root class="w-full">
    <Card.Header class="gap-5 p-6">
      <OAuthAuthorizeSidePanel {appName} />
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
          message={data.message ?? ""}
          title={data.title ?? "OAuth"}
        />
      {:else if data.copy}
        <OAuthAuthorizeConsentPanel
          copy={data.copy}
          oauthQuery={data.oauthQuery ?? ""}
          scope={data.scope ?? ""}
          scopes={data.scopes ?? []}
        />
      {/if}
    </Card.Content>
  </Card.Root>
</section>
