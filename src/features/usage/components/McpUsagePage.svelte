<script lang="ts">
import CableIcon from "@lucide/svelte/icons/cable";
import CheckIcon from "@lucide/svelte/icons/check";
import CopyIcon from "@lucide/svelte/icons/copy";
import DownloadIcon from "@lucide/svelte/icons/download";
import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
import { writeClipboardText } from "$lib/browser/clipboard";

type ClientCopy = {
  emptyAlt: string;
  filledAlt: string;
  note?: string;
  steps: string[];
};

type McpCopy = {
  chatgpt: ClientCopy & {
    iconAction: string;
    iconAlt: string;
    iconHint: string;
    filledSrc: string;
    overviewAlt: string;
    overviewSrc: string;
  };
  claude: ClientCopy;
  clientTabs: {
    chatgpt: string;
    claude: string;
    localLabel: string;
    other: string;
    webLabel: string;
  };
  configurationTitle: string;
  copiedValueAction: string;
  copiedAction: string;
  copyValueAction: string;
  endpointLabel: string;
  fieldLabels: {
    description: string;
    name: string;
    serverUrl: string;
  };
  otherClients: {
    description: string;
    title: string;
  };
  primaryAction: string;
  subtitle: string;
  title: string;
  useCaseAlt: string;
  useCaseTitle: string;
};

type PageData = {
  copy: McpCopy;
  metadataTitle: string;
};

export let data: PageData;

const MCP_ENDPOINT = "https://life-ustc.tiankaima.dev/api/mcp";
const CHATGPT_DOCS_URL =
  "https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta";
const CHATGPT_DESCRIPTION = "Modern, unified MCP entrypoint of USTC";
const CODEX_COMMAND = `codex mcp add life-ustc --url ${MCP_ENDPOINT}\ncodex mcp login life-ustc`;
const CLAUDE_CODE_COMMAND = `claude mcp add --scope user --transport http life-ustc ${MCP_ENDPOINT}`;

let copiedKey: string | null = null;
let activeClient: "chatgpt" | "claude" | "other" = "chatgpt";

async function copyValue(key: string, value: string) {
  await writeClipboardText(value);
  copiedKey = key;
  window.setTimeout(() => {
    if (copiedKey === key) copiedKey = null;
  }, 1800);
}

function copyEndpoint() {
  return copyValue("endpoint", MCP_ENDPOINT);
}
</script>

<svelte:head><title>{data.metadataTitle} - Life@USTC</title></svelte:head>

{#snippet copyField(key: string, label: string, value: string)}
  <button
    class="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-background p-3 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    type="button"
    onclick={() => copyValue(key, value)}
  >
    <span class="grid min-w-0 flex-1 gap-0.5">
      <span class="text-muted-foreground text-xs">{label}</span>
      <code class="truncate font-mono text-sm">{value}</code>
    </span>
    <span
      class="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs group-hover:text-foreground"
    >
      {#if copiedKey === key}
        <CheckIcon class="size-4" />
        <span class="hidden sm:inline">{data.copy.copiedValueAction}</span>
      {:else}
        <CopyIcon class="size-4" />
        <span class="hidden sm:inline">{data.copy.copyValueAction}</span>
      {/if}
    </span>
  </button>
{/snippet}

{#snippet commandField(key: string, title: string, value: string)}
  <div class="grid gap-2">
    <h4 class="font-medium text-sm">{title}</h4>
    <button
      class="group flex min-w-0 items-start gap-3 rounded-xl border border-border bg-background p-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      type="button"
      onclick={() => copyValue(key, value)}
    >
      <code class="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-sm leading-6">{value}</code>
      {#if copiedKey === key}
        <CheckIcon class="mt-1 size-4 shrink-0" />
      {:else}
        <CopyIcon class="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
      {/if}
    </button>
  </div>
{/snippet}

{#snippet chatgptFormValues()}
  <div class="grid gap-2">
    <a
      class="flex items-center gap-3 rounded-xl border border-border bg-muted/60 p-3 text-sm no-underline transition hover:bg-muted"
      download="life-ustc-chatgpt-icon.png"
      href="/images/usage/mcp-chatgpt-icon.png"
    >
      <img
        alt={data.copy.chatgpt.iconAlt}
        class="size-12 rounded-xl border border-border bg-white object-cover"
        src="/images/usage/mcp-chatgpt-icon.png"
      />
      <span class="grid flex-1 gap-0.5">
        <strong class="font-medium">{data.copy.chatgpt.iconAction}</strong>
        <span class="text-muted-foreground text-xs leading-5">
          {data.copy.chatgpt.iconHint}
        </span>
      </span>
      <DownloadIcon class="size-4 shrink-0" />
    </a>
    {@render copyField("chatgpt-name", data.copy.fieldLabels.name, "Life @ USTC")}
    {@render copyField(
      "chatgpt-description",
      data.copy.fieldLabels.description,
      CHATGPT_DESCRIPTION,
    )}
    {@render copyField("chatgpt-url", data.copy.fieldLabels.serverUrl, MCP_ENDPOINT)}
  </div>
{/snippet}

<section class="grid gap-6 pb-10 sm:gap-12">
  <div
    class="mcp-intro relative -mx-4 -mt-4 overflow-hidden bg-[radial-gradient(120%_80%_at_10%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_55%),linear-gradient(180deg,color-mix(in_oklab,var(--muted)_55%,transparent),var(--background))] sm:-mx-5 lg:-mx-6"
  >
    <div
      class="grid items-center gap-8 px-4 py-8 sm:px-5 sm:py-10 lg:grid-cols-[minmax(20rem,0.78fr)_minmax(32rem,1.22fr)] lg:gap-12 lg:px-6 lg:py-10"
    >
      <div class="grid max-w-xl gap-6">
        <div
          class="flex size-14 items-center justify-center rounded-2xl border border-border bg-violet-500/10 text-violet-600 shadow-sm dark:text-violet-400"
        >
          <CableIcon class="size-7" strokeWidth={1.8} />
        </div>
        <div class="grid gap-3">
          <h1 class="text-balance font-semibold text-4xl tracking-tight sm:text-5xl lg:text-6xl">
            {data.copy.title}
          </h1>
          <p class="max-w-lg text-pretty text-base text-muted-foreground sm:text-lg">
            {data.copy.subtitle}
          </p>
        </div>
        <button
          class="flex h-10 w-fit items-center gap-2 rounded-md bg-primary px-4 font-medium text-primary-foreground text-sm shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
          onclick={copyEndpoint}
        >
          {#if copiedKey === "endpoint"}
            <CheckIcon class="size-4" />
            {data.copy.copiedAction}
          {:else}
            <CopyIcon class="size-4" />
            {data.copy.primaryAction}
          {/if}
        </button>
      </div>

      <figure
        class="relative mx-auto grid w-full max-w-sm gap-3 sm:max-w-xl lg:max-w-2xl lg:justify-self-end"
      >
        <div
          class="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-foreground/10"
        >
          <div class="flex h-11 items-center gap-2 border-border border-b px-4">
            <span class="size-2.5 rounded-full bg-red-400"></span>
            <span class="size-2.5 rounded-full bg-amber-400"></span>
            <span class="size-2.5 rounded-full bg-emerald-400"></span>
            <span class="ms-2 font-medium text-muted-foreground text-xs">
              {data.copy.useCaseTitle}
            </span>
          </div>
          <img
            alt={data.copy.useCaseAlt}
            class="h-auto max-h-52 w-full bg-white object-contain sm:max-h-none lg:max-h-[30rem]"
            decoding="async"
            loading="eager"
            src="/images/usage/mcp-use-case.png"
          />
        </div>
      </figure>
    </div>
  </div>

  <div class="grid gap-8">
    <h2 class="font-semibold text-2xl tracking-tight sm:text-3xl">
      {data.copy.configurationTitle}
    </h2>

    <div
      aria-label={data.copy.configurationTitle}
      class="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
    >
      <button
        aria-pressed={activeClient === "chatgpt"}
        class:bg-background={activeClient === "chatgpt"}
        class:shadow-sm={activeClient === "chatgpt"}
        class="flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-2.5 font-medium text-sm transition hover:bg-background/70 sm:px-4"
        type="button"
        onclick={() => (activeClient = "chatgpt")}
      >
        <span class="truncate">{data.copy.clientTabs.chatgpt}</span>
        <span class="hidden rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs sm:inline">
          {data.copy.clientTabs.webLabel}
        </span>
      </button>
      <button
        aria-pressed={activeClient === "claude"}
        class:bg-background={activeClient === "claude"}
        class:shadow-sm={activeClient === "claude"}
        class="flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-2.5 font-medium text-sm transition hover:bg-background/70 sm:px-4"
        type="button"
        onclick={() => (activeClient = "claude")}
      >
        <span class="truncate">{data.copy.clientTabs.claude}</span>
        <span class="hidden rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs sm:inline">
          {data.copy.clientTabs.webLabel}
        </span>
      </button>
      <button
        aria-pressed={activeClient === "other"}
        class:bg-background={activeClient === "other"}
        class:shadow-sm={activeClient === "other"}
        class="flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-2.5 font-medium text-sm transition hover:bg-background/70 sm:px-4"
        type="button"
        onclick={() => (activeClient = "other")}
      >
        <span class="truncate">{data.copy.clientTabs.other}</span>
        <span class="hidden rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs sm:inline">
          {data.copy.clientTabs.localLabel}
        </span>
      </button>
    </div>

    {#if activeClient === "chatgpt"}
      <article class="grid gap-0">
        <div class="grid gap-10 py-10 lg:grid-cols-3 lg:items-start lg:gap-8 lg:py-14">
          <section class="grid min-w-0 gap-6 lg:content-start">
            <div class="grid gap-3">
              <span class="font-mono text-muted-foreground text-sm">01</span>
              <h4 class="text-balance font-semibold text-xl leading-8">
                <a
                  class="inline-flex items-center gap-2 text-foreground underline-offset-4 hover:underline"
                  href={CHATGPT_DOCS_URL}
                  rel="noreferrer"
                  target="_blank"
                >
                  {data.copy.chatgpt.steps[0]}
                  <ExternalLinkIcon class="size-4 shrink-0" />
                </a>
              </h4>
            </div>
            <a class="flex w-full items-start justify-center" href={data.copy.chatgpt.overviewSrc} rel="noreferrer" target="_blank">
              <img alt={data.copy.chatgpt.overviewAlt} class="h-auto max-h-[34rem] w-full bg-white object-contain" loading="lazy" src={data.copy.chatgpt.overviewSrc} />
            </a>
          </section>

          <section class="grid min-w-0 gap-6 lg:content-start">
            <div class="grid gap-6">
              <div class="grid gap-3">
                <span class="font-mono text-muted-foreground text-sm">02</span>
                <h4 class="text-balance font-semibold text-xl leading-8">{data.copy.chatgpt.steps[1]}</h4>
              </div>
              {@render chatgptFormValues()}
            </div>
            <a class="flex w-full items-start justify-center" href={data.copy.chatgpt.filledSrc} rel="noreferrer" target="_blank">
              <img alt={data.copy.chatgpt.filledAlt} class="h-auto max-h-[42rem] w-full bg-white object-contain" loading="lazy" src={data.copy.chatgpt.filledSrc} />
            </a>
          </section>

          <section class="grid min-w-0 gap-6 lg:content-start">
            <div class="grid gap-3">
              <span class="font-mono text-muted-foreground text-sm">03</span>
              <h4 class="text-balance font-semibold text-xl leading-8">{data.copy.chatgpt.steps[2]}</h4>
            </div>
            <a class="flex w-full items-start justify-center" href="/images/usage/mcp-use-case.png" rel="noreferrer" target="_blank">
              <img alt={data.copy.useCaseAlt} class="h-auto max-h-[34rem] w-full bg-white object-contain" loading="lazy" src="/images/usage/mcp-use-case.png" />
            </a>
          </section>
        </div>
      </article>
    {:else if activeClient === "claude"}
      <article class="grid gap-0">
        <div class="grid gap-10 py-10 lg:grid-cols-3 lg:items-start lg:gap-8 lg:py-14">
          <section class="grid min-w-0 gap-6 lg:content-start">
            <div class="grid gap-3">
              <span class="font-mono text-muted-foreground text-sm">01</span>
              <h4 class="text-balance font-semibold text-xl leading-8">{data.copy.claude.steps[0]}</h4>
            </div>
            <a class="flex w-full items-start justify-center" href="/images/usage/mcp-claude-empty.png" rel="noreferrer" target="_blank">
              <img alt={data.copy.claude.emptyAlt} class="h-auto max-h-[34rem] w-full bg-white object-contain" loading="lazy" src="/images/usage/mcp-claude-empty.png" />
            </a>
          </section>

          <section class="grid min-w-0 gap-6 lg:content-start">
            <div class="grid gap-6">
              <div class="grid gap-3">
                <span class="font-mono text-muted-foreground text-sm">02</span>
                <h4 class="text-balance font-semibold text-xl leading-8">{data.copy.claude.steps[1]}</h4>
              </div>
              <div class="grid gap-2">
                {@render copyField("claude-name", data.copy.fieldLabels.name, "Life@USTC")}
                {@render copyField("claude-url", data.copy.fieldLabels.serverUrl, MCP_ENDPOINT)}
              </div>
              <p class="text-muted-foreground text-sm leading-6">{data.copy.claude.note}</p>
            </div>
            <a class="flex w-full items-start justify-center" href="/images/usage/mcp-claude-filled.png" rel="noreferrer" target="_blank">
              <img alt={data.copy.claude.filledAlt} class="h-auto max-h-[42rem] w-full bg-white object-contain" loading="lazy" src="/images/usage/mcp-claude-filled.png" />
            </a>
          </section>

          <section class="grid min-w-0 gap-6 lg:content-start">
            <div class="grid gap-3">
              <span class="font-mono text-muted-foreground text-sm">03</span>
              <h4 class="text-balance font-semibold text-xl leading-8">{data.copy.claude.steps[2]}</h4>
            </div>
            <a class="flex w-full items-start justify-center" href="/images/usage/mcp-use-case.png" rel="noreferrer" target="_blank">
              <img alt={data.copy.useCaseAlt} class="h-auto max-h-[34rem] w-full bg-white object-contain" loading="lazy" src="/images/usage/mcp-use-case.png" />
            </a>
          </section>
        </div>
      </article>
    {:else}
      <article class="grid gap-7 py-10 lg:grid-cols-[minmax(18rem,0.65fr)_minmax(0,1.35fr)] lg:items-start lg:gap-12 lg:py-14">
        <div class="grid gap-3">
          <h3 class="font-semibold text-xl">{data.copy.otherClients.title}</h3>
          <p class="text-muted-foreground text-sm leading-6">
            {data.copy.otherClients.description}
          </p>
        </div>
        <div class="grid min-w-0 gap-4">
          {@render commandField("codex-command", "Codex", CODEX_COMMAND)}
          {@render commandField("claude-code-command", "Claude Code", CLAUDE_CODE_COMMAND)}
          <div class="grid gap-2">
            {@render copyField("other-endpoint", data.copy.endpointLabel, MCP_ENDPOINT)}
          </div>
        </div>
      </article>
    {/if}
  </div>
</section>
