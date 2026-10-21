<script lang="ts">
import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
import BotIcon from "@lucide/svelte/icons/bot";
import CheckIcon from "@lucide/svelte/icons/check";
import CopyIcon from "@lucide/svelte/icons/copy";
import QrCodeIcon from "@lucide/svelte/icons/qr-code";
import TerminalIcon from "@lucide/svelte/icons/terminal";
import { writeClipboardText } from "#lib/browser/clipboard.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Popover from "#lib/components/ui/popover/index.js";
import {
  usageMarketingBlurbClass,
  usageMarketingCtaRowClass,
  usageMarketingExampleCardBodyClass,
  usageMarketingExampleCardClass,
  usageMarketingExampleGridClass,
  usageMarketingHeroCopyClass,
  usageMarketingHeroGridClass,
  usageMarketingHeroShellClass,
  usageMarketingIconClass,
  usageMarketingIconGlyphClass,
  usageMarketingPageClass,
  usageMarketingPrimaryCtaClass,
  usageMarketingSectionTitleClass,
  usageMarketingStepIndex,
  usageMarketingStepIndexClass,
  usageMarketingTitleClass,
} from "../lib/usage-marketing-layout.js";

type GuideKind = "bot" | "cli";

type GuideCopy = {
  copiedInstallAction?: string;
  copyInstallAction?: string;
  installCommand?: string;
  installTitle?: string;
  previewAriaLabel?: string;
  previewLines?: Array<{ kind: string; src?: string; text: string }>;
  previewTitle?: string;
  primaryAction: string;
  primaryQrAlt?: string;
  startTitle: string;
  steps: Array<{
    description?: string;
    imageSrc?: string;
    resultLines?: string[];
    title: string;
  }>;
  subtitle: string;
  title: string;
};

type PageData = {
  copy: GuideCopy;
  metadataTitle: string;
};

export let data: PageData;
export let kind: GuideKind;
export let primaryHref: string;
export let primaryQrSrc: string | undefined = undefined;

let installCopied = false;

async function copyInstallCommand() {
  const command = data.copy.installCommand;
  if (!command) return;
  await writeClipboardText(command);
  installCopied = true;
  window.setTimeout(() => {
    installCopied = false;
  }, 1800);
}
</script>

<style>
  @keyframes usage-rise {
    from {
      opacity: 0;
      transform: translateY(1.25rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .hero-copy {
    animation: usage-rise 0.7s ease-out both;
  }

  .hero-preview {
    animation: usage-rise 0.85s 0.08s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .content-section {
    animation: usage-rise 0.7s 0.15s ease-out both;
  }

  .imessage-outgoing,
  .imessage-incoming {
    position: relative;
  }

  .imessage-outgoing {
    --imessage-outgoing-background: #0071e3;

    border-radius: 1.15rem 1.15rem 0.35rem 1.15rem;
    background: var(--imessage-outgoing-background);
    color: white;
  }

  .imessage-outgoing::after {
    position: absolute;
    right: -0.38rem;
    bottom: 0;
    width: 0.75rem;
    height: 0.85rem;
    background: var(--imessage-outgoing-background);
    clip-path: polygon(0 0, 100% 100%, 0 100%);
    content: "";
  }

  .imessage-incoming {
    border-radius: 1.15rem 1.15rem 1.15rem 0.35rem;
    background: #e9e9eb;
    padding: 0.2rem;
  }

  .imessage-incoming::after {
    position: absolute;
    bottom: 0;
    left: -0.38rem;
    width: 0.75rem;
    height: 0.85rem;
    background: #e9e9eb;
    clip-path: polygon(100% 0, 100% 100%, 0 100%);
    content: "";
  }

  :global(.dark) .imessage-incoming,
  :global(.dark) .imessage-incoming::after {
    background: #3a3a3c;
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-copy,
    .hero-preview,
    .content-section {
      animation: none;
    }
  }
</style>

<svelte:head><title>{data.metadataTitle} - Life@USTC</title></svelte:head>

{#if installCopied}
  <span class="sr-only" aria-live="polite">
    {data.copy.copiedInstallAction}
  </span>
{/if}

<section class={usageMarketingPageClass} data-usage-marketing="page">
  <div class={usageMarketingHeroShellClass} data-usage-marketing="hero">
    <div
      class={`${usageMarketingHeroGridClass} ${kind === "bot" ? "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" : ""}`}
    >
      <div class={usageMarketingHeroCopyClass}>
        <div class={usageMarketingIconClass}>
          {#if kind === "bot"}
            <BotIcon class={usageMarketingIconGlyphClass} strokeWidth={1.8} />
          {:else}
            <TerminalIcon
              class={usageMarketingIconGlyphClass}
              strokeWidth={1.8}
            />
          {/if}
        </div>

        <div class="grid gap-3">
          <h1 class={usageMarketingTitleClass}>{data.copy.title}</h1>
          <p class={usageMarketingBlurbClass}>{data.copy.subtitle}</p>
        </div>

        <div class={usageMarketingCtaRowClass}>
          <Button
            class={usageMarketingPrimaryCtaClass}
            href={primaryHref}
            rel="noreferrer"
            target="_blank"
          >
            {data.copy.primaryAction}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
          {#if primaryQrSrc}
            <Popover.Root>
              <Popover.Trigger>
                {#snippet child({ props })}
                  <Button
                    {...props}
                    aria-label={data.copy.primaryQrAlt}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                  >
                    <QrCodeIcon data-icon="inline-start" aria-hidden="true" />
                  </Button>
                {/snippet}
              </Popover.Trigger>
              <Popover.Content
                align="start"
                class="w-auto max-w-[calc(100vw-2rem)] overflow-hidden p-2"
                sideOffset={8}
              >
                <Popover.Title class="sr-only">
                  {data.copy.primaryQrAlt}
                </Popover.Title>
                <img
                  alt={data.copy.primaryQrAlt}
                  class="size-40 max-w-full"
                  decoding="async"
                  src={primaryQrSrc}
                />
              </Popover.Content>
            </Popover.Root>
          {/if}
        </div>
      </div>

      {#if kind === "bot"}
        <div class="hero-preview relative mx-auto w-full max-w-2xl lg:justify-self-end">
          <div
            class="pointer-events-none absolute inset-x-10 bottom-0 h-24 rounded-full bg-foreground/10 blur-3xl"
            aria-hidden="true"
          ></div>
          <div
            class="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-foreground/10"
            aria-label={data.copy.previewAriaLabel}
          >
            <div class="flex h-11 items-center gap-2 border-border border-b px-4">
              <span class="size-2.5 rounded-full bg-red-400"></span>
              <span class="size-2.5 rounded-full bg-amber-400"></span>
              <span class="size-2.5 rounded-full bg-emerald-400"></span>
              <span class="ms-2 truncate font-medium text-muted-foreground text-xs">
                {data.copy.previewTitle}
              </span>
            </div>

            <div class="grid min-h-72 content-center gap-3 p-5 sm:min-h-80 sm:p-7">
              {#each data.copy.previewLines ?? [] as line}
                {#if line.kind === "image"}
                  <div class="imessage-incoming w-full max-w-[85%] shadow-md">
                    <img
                      alt={line.text}
                      class="h-auto w-full rounded-[1rem] bg-white"
                      decoding="async"
                      loading="eager"
                      src={line.src}
                    />
                  </div>
                {:else}
                  <div
                    class:ms-auto={line.kind === "command"}
                    class:imessage-outgoing={line.kind === "command"}
                    class="max-w-[85%] px-3.5 py-2 font-sans text-sm leading-6"
                  >
                    {line.text}
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <div class="content-section grid gap-12" data-usage-marketing="examples">
    {#if kind === "cli" && data.copy.installCommand}
      <div
        class="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-5 sm:p-6"
        data-usage-marketing="install"
      >
        <h2 class="font-semibold text-lg">{data.copy.installTitle}</h2>
        <Button
          class="group h-auto min-w-0 w-full justify-between rounded-xl bg-muted px-4 py-3 text-left whitespace-normal hover:bg-muted/80"
          type="button"
          variant="ghost"
          onclick={copyInstallCommand}
        >
          <span class="sr-only">{data.copy.copyInstallAction}</span>
          <code class="min-w-0 flex-1 overflow-x-auto font-mono text-sm"
            >{data.copy.installCommand}</code
          >
          {#if installCopied}
            <CheckIcon class="ms-3 shrink-0" data-icon="inline-end" />
          {:else}
            <CopyIcon
              class="ms-3 shrink-0 text-muted-foreground group-hover:text-foreground"
              data-icon="inline-end"
            />
          {/if}
        </Button>
      </div>
    {/if}

    <div class="grid gap-6">
      <h2 class={usageMarketingSectionTitleClass}>{data.copy.startTitle}</h2>
      <div class={usageMarketingExampleGridClass}>
        {#each data.copy.steps as step, index}
          {#if kind === "bot"}
            <article
              class="mx-auto grid h-full w-full min-w-0 content-start gap-3 p-2 sm:p-3"
              data-usage-marketing="example-card"
            >
              <span class={usageMarketingStepIndexClass}>
                {usageMarketingStepIndex(index)}
              </span>
              <div
                class="imessage-outgoing ms-auto px-3.5 py-2 font-sans text-sm"
              >
                {step.title}
              </div>
              {#if step.imageSrc}
                <div class="imessage-incoming w-[calc(100%-0.5rem)] shadow-sm">
                  <img
                    alt={step.description ?? step.title}
                    class="h-auto w-full rounded-[1rem] bg-white"
                    decoding="async"
                    loading="lazy"
                    src={step.imageSrc}
                  />
                </div>
              {/if}
            </article>
          {:else}
            <article
              class={usageMarketingExampleCardClass}
              data-usage-marketing="example-card"
            >
              <div class={usageMarketingExampleCardBodyClass}>
                <span class={usageMarketingStepIndexClass}>
                  {usageMarketingStepIndex(index)}
                </span>
                <div class="grid grid-cols-[auto_minmax(0,1fr)] gap-2 font-mono text-sm">
                  <span class="text-muted-foreground">$</span>
                  <code class="break-words">{step.title}</code>
                </div>
                <pre
                  class="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap font-mono text-muted-foreground text-xs leading-6">{(step.resultLines ?? []).join("\n")}</pre
                >
              </div>
            </article>
          {/if}
        {/each}
      </div>
    </div>
  </div>
</section>
