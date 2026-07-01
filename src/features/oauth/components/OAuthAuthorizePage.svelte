<script lang="ts">
import PageHeader from "$lib/components/PageHeader.svelte";
import * as Card from "$lib/components/ui/card/index.js";
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
$: sideNoteLabel =
  data.state === "error"
    ? (data.title ?? "OAuth")
    : (data.copy?.scopesLabel ?? "OAuth");
</script>

<svelte:head><title>{pageTitle} - Life@USTC</title></svelte:head>

<section class="mx-auto grid w-full max-w-4xl gap-6 py-8">
  <PageHeader title={pageTitle} description={pageDescription} eyebrow="OAuth" />

  <div class="grid overflow-hidden rounded-md border border-base-300 bg-base-100 shadow-sm lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
    <OAuthAuthorizeSidePanel {appName} {sideNoteLabel} />

    <Card.Root class="border-0 shadow-none">
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
  </div>
</section>
