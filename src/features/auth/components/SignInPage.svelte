<script lang="ts">
import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
import CircleUserRound from "@lucide/svelte/icons/circle-user-round";
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import PageHeader from "$lib/components/PageHeader.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import { redirectWithExternalFallback } from "$lib/navigation/redirect";

type PageData = {
  callbackUrl: string;
  copy: {
    errorAccountNotLinked: string;
    errorGeneric: string;
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
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,color-mix(in_oklch,var(--color-primary)_20%,transparent),transparent_38%),linear-gradient(135deg,color-mix(in_oklch,var(--color-primary)_10%,var(--color-base-100)),var(--color-base-200))]"></div>
    <img
      aria-hidden="true"
      alt=""
      class="absolute top-1/2 left-1/2 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rotate-12 opacity-20 blur-[1px] saturate-125"
      src="/images/icon.png"
    />
  </div>

  <div class="grid w-full max-w-md gap-6 px-4">
    <PageHeader title={data.copy.title} />

    <div class="grid gap-4 rounded-2xl border border-base-100/60 bg-base-100/70 p-4 shadow-xl shadow-primary/5 backdrop-blur-xl supports-[backdrop-filter]:bg-base-100/55">
      {#if data.error}
        <Alert.Root variant="destructive">
          <Alert.Description>{data.error === "OAuthAccountNotLinked" ? data.copy.errorAccountNotLinked : data.copy.errorGeneric}</Alert.Description>
        </Alert.Root>
      {/if}
      {#if form?.message}
        <Alert.Root variant="destructive">
          <Alert.Description>{form.message}</Alert.Description>
        </Alert.Root>
      {/if}

      <Item.Group>
        {#each data.providers as provider}
          <form method="POST" use:enhance={signInAction(provider.id)}>
            <input type="hidden" name="providerId" value={provider.id} />
            <input type="hidden" name="callbackUrl" value={data.callbackUrl} />
            <Item.Root
              class="text-left disabled:pointer-events-none disabled:opacity-50"
              variant="outline"
            >
              {#snippet child({ props })}
                <button {...props} disabled={Boolean(pendingProviderId)} type="submit">
                  <Item.Media
                    class="size-8 rounded-md bg-muted font-semibold text-primary text-xs"
                    variant="icon"
                  >
                  {#if pendingProviderId === provider.id}
                    <Spinner />
                  {:else if provider.debug}
                    <CircleUserRound />
                  {:else}
                    {providerInitial(provider.name)}
                  {/if}
                  </Item.Media>
                  <Item.Content class="min-w-0">
                    <Item.Title>{provider.label}</Item.Title>
                  </Item.Content>
                  <Item.Actions>
                    <ArrowUpRight />
                  </Item.Actions>
                </button>
              {/snippet}
            </Item.Root>
          </form>
        {/each}
      </Item.Group>

      <p class="text-center text-base-content/55 text-xs leading-5">
        {data.copy.termsNotice.beforeTerms}<a class="text-primary hover:underline" href="/terms">{data.copy.termsNotice.terms}</a>{data.copy.termsNotice.between}<a class="text-primary hover:underline" href="/privacy">{data.copy.termsNotice.privacy}</a>{data.copy.termsNotice.afterPrivacy}
      </p>
    </div>
  </div>
</section>
