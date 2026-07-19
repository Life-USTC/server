<script lang="ts">
import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import CircleUserRound from "@lucide/svelte/icons/circle-user-round";
import Fingerprint from "@lucide/svelte/icons/fingerprint";
import type { SubmitFunction } from "@sveltejs/kit";
import { onMount } from "svelte";
import { enhance } from "$app/forms";
import {
  isPasskeySupported,
  passkeyAuthClient,
  passkeyClientErrorKind,
} from "$lib/auth/passkey-client";
import PageHeader from "$lib/components/PageHeader.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import { redirectWithExternalFallback } from "$lib/navigation/redirect";

type PageData = {
  callbackUrl: string;
  copy: {
    errorAccountNotLinked: string;
    errorGeneric: string;
    passkeyCancelled: string;
    passkeyChecking: string;
    passkeyError: string;
    passkeyPending: string;
    passkeySignIn: string;
    passkeyUnsupported: string;
    termsNotice: {
      afterPrivacy: string;
      beforeTerms: string;
      between: string;
      privacy: string;
      terms: string;
    };
    title: string;
  };
  error?: string | null;
  providers: Array<{
    debug?: boolean;
    id: string;
    label: string;
    name: string;
  }>;
};

type ActionData = {
  message?: string;
} | null;

export let data: PageData;
export let form: ActionData;

let pendingProviderId: string | null = null;
let passkeyError: string | null = null;
let passkeyPending = false;
let passkeySupport: "checking" | "supported" | "unsupported" = "checking";

onMount(() => {
  passkeySupport = isPasskeySupported() ? "supported" : "unsupported";
});

async function signInWithPasskey() {
  if (passkeySupport !== "supported" || passkeyPending) return;

  passkeyError = null;
  passkeyPending = true;
  try {
    const result = await passkeyAuthClient.signIn.passkey();
    if (result.error) {
      passkeyError =
        passkeyClientErrorKind(result.error) === "cancelled"
          ? data.copy.passkeyCancelled
          : data.copy.passkeyError;
      return;
    }
    await redirectWithExternalFallback(data.callbackUrl);
  } catch {
    passkeyError = data.copy.passkeyError;
  } finally {
    passkeyPending = false;
  }
}

function signInAction(providerId: string): SubmitFunction {
  return () => {
    pendingProviderId = providerId;
    return async ({ result, update }) => {
      if (result.type === "redirect") {
        await redirectWithExternalFallback(result.location);
        return;
      }
      await update({ reset: false });
      pendingProviderId = null;
    };
  };
}

function providerInitial(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}
</script>

<svelte:head><title>{data.copy.title} - Life@USTC</title></svelte:head>

<section class="relative mx-auto grid min-h-[calc(100vh-14rem)] w-full max-w-5xl place-items-center overflow-hidden py-10">
  <div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[2rem]">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,color-mix(in_oklch,var(--color-primary)_20%,transparent),transparent_38%),linear-gradient(135deg,color-mix(in_oklch,var(--color-primary)_10%,var(--color-card)),var(--color-background))]"></div>
    <img
      aria-hidden="true"
      alt=""
      class="absolute top-1/2 left-1/2 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rotate-12 opacity-20 blur-[1px] saturate-125"
      src="/images/icon.png"
    />
  </div>

  <div class="grid w-full max-w-md gap-6 px-4">
    <PageHeader title={data.copy.title} />

    <Card.Root>
      <Card.Content class="grid gap-4">
        {#if data.error}
          <Alert.Root variant="destructive">
            <Alert.Description>
              {data.error === "OAuthAccountNotLinked" ? data.copy.errorAccountNotLinked : data.copy.errorGeneric}
            </Alert.Description>
          </Alert.Root>
        {/if}
        {#if form?.message}
          <Alert.Root variant="destructive">
            <Alert.Description>{form.message}</Alert.Description>
          </Alert.Root>
        {/if}

        <div class="grid gap-2">
          {#each data.providers as provider}
            <form method="POST" use:enhance={signInAction(provider.id)}>
              <input type="hidden" name="providerId" value={provider.id} />
              <input type="hidden" name="callbackUrl" value={data.callbackUrl} />
              <Button
                class="h-auto w-full justify-start p-3 text-left"
                disabled={Boolean(pendingProviderId) || passkeyPending}
                type="submit"
                variant="outline"
              >
                <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted font-semibold text-primary text-xs">
                  {#if pendingProviderId === provider.id}
                    <Spinner data-icon="inline-start" />
                  {:else if provider.debug}
                    <CircleUserRound />
                  {:else}
                    {providerInitial(provider.name)}
                  {/if}
                </span>
                <span class="min-w-0 flex-1 truncate">{provider.label}</span>
                <ArrowUpRight data-icon="inline-end" />
              </Button>
            </form>
          {/each}
        </div>

        <div class="grid gap-2">
          <Button
            class="h-auto w-full justify-start p-3 text-left"
            disabled={passkeySupport !== "supported" || passkeyPending || Boolean(pendingProviderId)}
            onclick={signInWithPasskey}
            type="button"
            variant="outline"
          >
            <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
              {#if passkeyPending}
                <Spinner data-icon="inline-start" />
              {:else}
                <Fingerprint />
              {/if}
            </span>
            <span class="min-w-0 flex-1 truncate">
              {passkeyPending
                ? data.copy.passkeyPending
                : passkeySupport === "checking"
                  ? data.copy.passkeyChecking
                  : data.copy.passkeySignIn}
            </span>
          </Button>

          {#if passkeySupport === "unsupported"}
            <Alert.Root>
              <Alert.Description>{data.copy.passkeyUnsupported}</Alert.Description>
            </Alert.Root>
          {:else if passkeyError}
            <Alert.Root variant="destructive">
              <Alert.Description>{passkeyError}</Alert.Description>
            </Alert.Root>
          {/if}
        </div>

        <p class="text-muted-foreground text-center text-xs leading-5">
          {data.copy.termsNotice.beforeTerms}<a class="text-primary hover:underline" href="/terms">{data.copy.termsNotice.terms}</a>{data.copy.termsNotice.between}<a class="text-primary hover:underline" href="/privacy">{data.copy.termsNotice.privacy}</a>{data.copy.termsNotice.afterPrivacy}
        </p>
      </Card.Content>
    </Card.Root>
  </div>
</section>
