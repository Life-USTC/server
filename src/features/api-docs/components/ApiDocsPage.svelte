<script lang="ts">
import CloudAlertIcon from "@lucide/svelte/icons/cloud-alert";
import MenuIcon from "@lucide/svelte/icons/menu";
import type { ApiReferenceConfiguration } from "@scalar/api-reference";
import { onMount, tick } from "svelte";
import { OPENAPI_SPEC_API_PATH } from "#lib/openapi/spec.js";
import { afterNavigate } from "$app/navigation";
import "@scalar/api-reference/style.css";
import "./api-docs-scalar.css";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Empty from "#lib/components/ui/empty/index.js";
import * as Sheet from "#lib/components/ui/sheet/index.js";
import {
  type ApiDocsSelection,
  getApiDocsSelection,
  type OpenApiDocument,
} from "../lib/docs-navigation";

type PageData = {
  copy: {
    apiDocs: {
      browseNavigation: string;
      description: string;
      loadErrorDescription: string;
      loadErrorTitle: string;
      navigationLabel: string;
      rawSpecLink: string;
      title: string;
    };
    common: {
      loading: string;
      tryAgain: string;
    };
    metadata: { apiDocs: string };
  };
};

type ReferenceConfig = Partial<ApiReferenceConfiguration> & {
  agent?: { disabled: boolean };
};

export let data: PageData;

const specPath = OPENAPI_SPEC_API_PATH;

let currentPath = "";
let apiDocument: OpenApiDocument | undefined;
let selectedDocs: ApiDocsSelection | undefined;
let mounted = false;
let reference: { destroy: () => void } | undefined;
let sidebarScrollY: number | undefined;
let mobileNavigationOpen = false;
let loadError = false;
let loading = true;

const referenceConfig = (content: OpenApiDocument) =>
  ({
    content,
    layout: "modern",
    theme: "none",
    showSidebar: false,
    showDeveloperTools: "never",
    hideClientButton: true,
    hideDarkModeToggle: true,
    hiddenClients: true,
    hideModels: true,
    hideSearch: true,
    documentDownloadType: "none",
    withDefaultFonts: false,
    persistAuth: false,
    onLoaded: () => scheduleReferenceRouteRestore(),
    setPageTitle: ({ title }) => {
      scheduleReferenceRouteRestore();
      return title;
    },
    agent: { disabled: true },
    mcp: { disabled: true },
  }) satisfies ReferenceConfig;

afterNavigate(({ to, shallow, type }) => {
  if (shallow && type === "goto") return;

  currentPath = to?.url.pathname ?? window.location.pathname;
  if (mounted && apiDocument) void renderReference();
});

onMount(() => {
  mounted = true;
  void loadSpec();

  return () => {
    mounted = false;
    reference?.destroy();
  };
});

async function loadSpec() {
  loading = true;
  loadError = false;
  try {
    const response = await fetch(specPath);
    if (!response.ok)
      throw new Error(`OpenAPI request failed: ${response.status}`);
    apiDocument = await response.json();
    await renderReference();
  } catch (error) {
    console.error("Failed to load API documentation", error);
    apiDocument = undefined;
    selectedDocs = undefined;
    loadError = true;
  } finally {
    loading = false;
  }
}

async function renderReference() {
  if (!apiDocument) return;
  selectedDocs = getApiDocsSelection(
    apiDocument,
    currentPath || window.location.pathname,
  );

  // The reference container only exists once the success branch is rendered;
  // after a retry it is still queued when this runs.
  await tick();
  const container = document.getElementById("api-reference");
  if (!container) return;
  container.replaceChildren();
  reference?.destroy();

  const { createApiReference } = await import("@scalar/api-reference");
  if (!mounted || !selectedDocs) return;
  reference = createApiReference(
    container,
    referenceConfig(selectedDocs.document),
  );
}

function handleNavigationClick(
  event: MouseEvent,
  closeMobileNavigation = false,
) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  sidebarScrollY = window.scrollY;
  if (closeMobileNavigation) mobileNavigationOpen = false;
}

function scheduleReferenceRouteRestore() {
  requestAnimationFrame(() => {
    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }

    if (sidebarScrollY !== undefined) {
      window.scrollTo({ top: sidebarScrollY });
      sidebarScrollY = undefined;
    }
  });
}
</script>

{#snippet apiNavigation(closeMobileNavigation = false)}
  {#if selectedDocs}
    {#each selectedDocs.groups as group}
      <section class="api-docs-nav-group">
        <h2>{group.name}</h2>
        <ul>
          {#each group.tags as tag}
            <li>
              <a
                aria-current={selectedDocs.activeHref === tag.href ? "page" : undefined}
                class:active={selectedDocs.activeHref === tag.href}
                class="api-docs-nav-tag"
                data-sveltekit-reset="false"
                href={tag.href}
                onclick={(event) => handleNavigationClick(event, closeMobileNavigation)}
              >
                {tag.displayName}
              </a>
              <ul class="api-docs-nav-operations">
                {#each tag.operations as operation}
                  <li>
                    <a
                      aria-current={selectedDocs.activeHref === operation.href ? "page" : undefined}
                      class:active={selectedDocs.activeHref === operation.href}
                      class="api-docs-nav-operation"
                      data-sveltekit-reset="false"
                      href={operation.href}
                      onclick={(event) => handleNavigationClick(event, closeMobileNavigation)}
                      title={`${operation.method.toUpperCase()} ${operation.path}`}
                    >
                      <span class="api-docs-method">{operation.method.toUpperCase()}</span>
                      <span class="api-docs-operation-label">{operation.summary}</span>
                    </a>
                  </li>
                {/each}
              </ul>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {:else}
    <p>{data.copy.common.loading}</p>
  {/if}
{/snippet}

<svelte:head><title>{data.copy.metadata.apiDocs} - Life@USTC</title></svelte:head>

<CollectionPage description={data.copy.apiDocs.description} panel={false} title={data.copy.apiDocs.title} width="full">
  {#snippet actions()}
      <Button class="w-full sm:w-auto" href={specPath} variant="outline">{data.copy.apiDocs.rawSpecLink}</Button>
  {/snippet}

  {#if loadError}
    <Empty.Root class="border border-border border-solid bg-card" data-testid="api-docs-load-error">
      <Empty.Header>
        <Empty.Media class="bg-destructive/10 text-destructive" variant="icon">
          <CloudAlertIcon aria-hidden="true" />
        </Empty.Media>
        <Empty.Title>{data.copy.apiDocs.loadErrorTitle}</Empty.Title>
        <Empty.Description>{data.copy.apiDocs.loadErrorDescription}</Empty.Description>
      </Empty.Header>
      <Empty.Content>
        <Button class="w-full sm:w-auto" type="button" onclick={() => void loadSpec()}>
          {data.copy.common.tryAgain}
        </Button>
      </Empty.Content>
    </Empty.Root>
  {:else}
    <div class="api-docs-shell">
      <div class="api-docs-mobile-navigation">
        <Sheet.Root bind:open={mobileNavigationOpen}>
          <Sheet.Trigger>
            {#snippet child({ props })}
              <Button
                class="w-full justify-between"
                data-testid="api-docs-mobile-navigation-trigger"
                type="button"
                variant="outline"
                {...props}
              >
                <span>{data.copy.apiDocs.browseNavigation}</span>
                <MenuIcon data-icon="inline-end" aria-hidden="true" />
              </Button>
            {/snippet}
          </Sheet.Trigger>
          <Sheet.Content
            class="w-[min(22rem,calc(100%-1rem))] overflow-y-auto p-0"
            data-testid="api-docs-mobile-navigation-panel"
            side="left"
          >
            <Sheet.Header class="border-b pr-12">
              <Sheet.Title>{data.copy.apiDocs.navigationLabel}</Sheet.Title>
              <Sheet.Description class="sr-only">
                {data.copy.apiDocs.browseNavigation}
              </Sheet.Description>
            </Sheet.Header>
            <nav class="api-docs-navigation p-4" aria-label={data.copy.apiDocs.navigationLabel}>
              {@render apiNavigation(true)}
            </nav>
          </Sheet.Content>
        </Sheet.Root>
      </div>

      <aside
        class="api-docs-navigation api-docs-sidebar"
        aria-label={data.copy.apiDocs.navigationLabel}
        data-testid="api-docs-desktop-navigation"
      >
        {@render apiNavigation()}
      </aside>

      <div id="api-reference" class="api-reference min-h-[42rem] overflow-hidden rounded-lg border border-border bg-background">
        {#if loading}
          <div class="p-6">
            <p class="text-muted-foreground text-sm">{data.copy.common.loading}</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</CollectionPage>
