<script lang="ts">
import appIconUrl from "#lib/assets/life-ustc-icon-192.png";
import PageHeader from "#lib/components/PageHeader.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Badge } from "#lib/components/ui/badge/index.js";
import * as Card from "#lib/components/ui/card/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import { Separator } from "#lib/components/ui/separator/index.js";
import OAuthAuthorizeConsentPanel from "@/features/oauth/components/OAuthAuthorizeConsentPanel.svelte";

import type { PageData } from "./$types";

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

<section class="mx-auto grid min-h-[calc(100dvh-14rem)] w-full max-w-2xl place-items-center py-10">
  <Card.Root class="w-full">
    <Card.Header class="gap-5 p-6">
      <Item.Root class="items-center" variant="muted">
        <Item.Media class="size-11" variant="image">
          <img class="size-full object-cover" src={appIconUrl} alt="Life@USTC" />
        </Item.Media>
        <Item.Content class="gap-1">
          <Badge class="w-fit" variant="secondary">OAuth</Badge>
          <Item.Title>{appName}</Item.Title>
          {#if data.clientHost && data.copy?.clientHostLabel}
            <Item.Description class="break-all">
              {data.copy?.clientHostLabel}: {data.clientHost}
            </Item.Description>
          {/if}
          {#if data.redirectHost && data.copy?.redirectHostLabel}
            <Item.Description class="break-all">
              {data.copy?.redirectHostLabel}: {data.redirectHost}
            </Item.Description>
          {/if}
          {#if data.redirectIsLoopback && data.copy?.loopbackRedirectWarning}
            <Alert.Root class="py-2" variant="destructive">
              <Alert.Description>{data.copy?.loopbackRedirectWarning}</Alert.Description>
            </Alert.Root>
          {/if}
        </Item.Content>
      </Item.Root>
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
        <Alert.Root variant="destructive">
          <Alert.Description>{data.message ?? ""}</Alert.Description>
          {#if data.hint}
            <Alert.Description class="text-destructive-text/90">{data.hint}</Alert.Description>
          {/if}
        </Alert.Root>
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
