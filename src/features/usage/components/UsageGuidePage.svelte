<script lang="ts">
import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
import BotIcon from "@lucide/svelte/icons/bot";
import QrCodeIcon from "@lucide/svelte/icons/qr-code";
import TerminalIcon from "@lucide/svelte/icons/terminal";
import { Button } from "$lib/components/ui/button/index.js";
import * as Popover from "$lib/components/ui/popover/index.js";

type GuideKind = "bot" | "cli";

type GuideCopy = {
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

$: iconTone =
  kind === "bot"
    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
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
    border-radius: 1.15rem 1.15rem 0.35rem 1.15rem;
    background: #0a84ff;
    color: white;
  }

  .imessage-outgoing::after {
    position: absolute;
    right: -0.38rem;
    bottom: 0;
    width: 0.75rem;
    height: 0.85rem;
    background: #0a84ff;
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

<section class="grid gap-14 pb-10 sm:gap-16">
  <div
    class="relative -mx-4 -mt-4 bg-[radial-gradient(120%_80%_at_10%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_55%),linear-gradient(180deg,color-mix(in_oklab,var(--muted)_55%,transparent),var(--background))] sm:-mx-5 lg:-mx-6"
  >
    <div
      class={`grid items-center gap-10 px-4 py-10 sm:px-5 sm:py-14 lg:gap-14 lg:px-6 lg:py-16 ${kind === "bot" ? "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" : ""}`}
    >
      <div class={`hero-copy grid gap-6 ${kind === "bot" ? "max-w-xl" : "max-w-3xl"}`}>
        <div
          class={`flex size-14 items-center justify-center rounded-2xl border border-border shadow-sm ${iconTone}`}
        >
          {#if kind === "bot"}
            <BotIcon class="size-7" strokeWidth={1.8} />
          {:else}
            <TerminalIcon class="size-7" strokeWidth={1.8} />
          {/if}
        </div>

        <div class="grid gap-3">
          <h1
            class={`font-semibold text-4xl tracking-tight sm:text-5xl ${kind === "cli" ? "lg:text-5xl" : "text-balance lg:text-6xl"}`}
          >
            {data.copy.title}
          </h1>
          <p class="max-w-lg text-pretty text-base text-muted-foreground sm:text-lg">
            {data.copy.subtitle}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <a
            class="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 font-medium text-primary-foreground text-sm no-underline shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={primaryHref}
            rel="noreferrer"
            target="_blank"
          >
            {data.copy.primaryAction}
            <ArrowRightIcon class="size-4" />
          </a>
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
                    <QrCodeIcon aria-hidden="true" class="size-4" />
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

  <div class="content-section grid gap-12">
    {#if kind === "bot"}
      <div class="grid gap-6">
        <h2 class="font-semibold text-2xl tracking-tight sm:text-3xl">
          {data.copy.startTitle}
        </h2>
        <div class="grid gap-5 md:grid-cols-3">
          {#each data.copy.steps as step}
            <article
              class="mx-auto grid w-full min-w-0 content-start gap-3 p-2 sm:p-3"
            >
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
          {/each}
        </div>
      </div>
    {:else}
      <div class="grid gap-6">
        {#if data.copy.installCommand}
          <div
            class="grid gap-2 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-5 sm:p-6"
          >
            <h2 class="font-semibold text-lg">{data.copy.installTitle}</h2>
            <code
              class="min-w-0 overflow-x-auto rounded-lg bg-muted px-4 py-3 font-mono text-sm"
              >{data.copy.installCommand}</code
            >
          </div>
        {/if}
        <h2 class="font-semibold text-2xl tracking-tight sm:text-3xl">
          {data.copy.startTitle}
        </h2>
        <div class="grid gap-5 xl:grid-cols-3">
          {#each data.copy.steps as step}
            <article
              class="grid min-w-0 content-start overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-sm"
            >
              <div class="grid gap-5 p-5 sm:p-6">
                <div class="grid grid-cols-[auto_minmax(0,1fr)] gap-2 font-mono text-sm">
                  <span class="text-emerald-600 dark:text-emerald-400">$</span>
                  <code class="break-words">{step.title}</code>
                </div>
                <pre
                  class="min-w-0 overflow-x-auto whitespace-pre-wrap font-mono text-muted-foreground text-xs leading-6">{(step.resultLines ?? []).join("\n")}</pre
                >
              </div>
            </article>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</section>
