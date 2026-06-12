<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import ArrowUpRight from "$lib/components/icons/arrow-up-right.svelte";
import CircleUserRound from "$lib/components/icons/circle-user-round.svelte";
import RefreshCw from "$lib/components/icons/refresh-cw.svelte";
import PageHeader from "$lib/components/PageHeader.svelte";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
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
        <Alert variant="destructive">
          <span>{data.error === "OAuthAccountNotLinked" ? data.copy.errorAccountNotLinked : data.copy.errorGeneric}</span>
        </Alert>
      {/if}
      {#if form?.message}
        <Alert variant="destructive">
          <span>{form.message}</span>
        </Alert>
      {/if}

      <div class="grid gap-2">
        {#each data.providers as provider}
          <form method="POST" use:enhance={signInAction(provider.id)}>
            <input type="hidden" name="providerId" value={provider.id} />
            <input type="hidden" name="callbackUrl" value={data.callbackUrl} />
            <Button class="h-auto w-full justify-between rounded-xl border-base-300/80 bg-base-100/80 px-4 py-3 text-left shadow-sm backdrop-blur transition hover:border-primary/60 hover:bg-base-100" disabled={Boolean(pendingProviderId)} size="lg" type="submit" variant="outline">
              <span class="flex min-w-0 items-center gap-3">
                <span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-base-300 bg-base-200 font-semibold text-primary text-xs">
                  {#if pendingProviderId === provider.id}
                    <RefreshCw class="animate-spin" />
                  {:else if provider.debug}
                    <CircleUserRound />
                  {:else}
                    {providerInitial(provider.name)}
                  {/if}
                </span>
                <span class="min-w-0 truncate font-medium">{provider.label}</span>
              </span>
              <ArrowUpRight class="shrink-0 text-base-content/45" />
            </Button>
          </form>
        {/each}
      </div>

      <p class="text-center text-base-content/55 text-xs leading-5">
        {data.copy.termsNotice.beforeTerms}<a class="text-primary hover:underline" href="/terms">{data.copy.termsNotice.terms}</a>{data.copy.termsNotice.between}<a class="text-primary hover:underline" href="/privacy">{data.copy.termsNotice.privacy}</a>{data.copy.termsNotice.afterPrivacy}
      </p>
    </div>
  </div>
</section>
