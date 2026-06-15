<script lang="ts">
import type { ApiReferenceConfiguration } from "@scalar/api-reference";
import { onMount } from "svelte";
import { afterNavigate } from "$app/navigation";
import { OPENAPI_SPEC_API_PATH } from "$lib/openapi/spec";
import "@scalar/api-reference/style.css";
import "./api-docs-scalar.css";
import PageHeader from "$lib/components/PageHeader.svelte";
import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import {
  type ApiDocsSelection,
  getApiDocsSelection,
  type OpenApiDocument,
} from "../lib/docs-navigation";

type PageData = {
  copy: {
    apiDocs: {
      description: string;
      rawSpecLink: string;
      title: string;
    };
    common: {
      home: string;
      loading: string;
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

afterNavigate(({ to }) => {
  currentPath = to?.url.pathname ?? window.location.pathname;
  if (mounted && apiDocument) void renderReference();
});

onMount(() => {
  mounted = true;

  async function loadSpec() {
    const response = await fetch(specPath);
    apiDocument = await response.json();
    await renderReference();
  }

  void loadSpec();

  return () => {
    mounted = false;
    reference?.destroy();
  };
});

async function renderReference() {
  if (!apiDocument) return;
  selectedDocs = getApiDocsSelection(
    apiDocument,
    currentPath || window.location.pathname,
  );

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

function rememberSidebarScrollPosition(event: MouseEvent) {
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

<svelte:head><title>{data.copy.metadata.apiDocs} - Life@USTC</title></svelte:head>

<section class="grid gap-5">
  <PageHeader title={data.copy.apiDocs.title} description={data.copy.apiDocs.description}>
    {#snippet breadcrumb()}
      <Breadcrumb.Root>
        <Breadcrumb.List>
          <Breadcrumb.Item><Breadcrumb.Link href="/">{data.copy.common.home}</Breadcrumb.Link></Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item><Breadcrumb.Page>{data.copy.apiDocs.title}</Breadcrumb.Page></Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>
    {/snippet}
    {#snippet actions()}
      <Button class="w-full sm:w-auto" href={specPath} size="sm" variant="outline">{data.copy.apiDocs.rawSpecLink}</Button>
    {/snippet}
  </PageHeader>

  <div class="api-docs-shell">
    <aside class="api-docs-sidebar" aria-label="API navigation">
      {#if selectedDocs}
        {#each selectedDocs.groups as group}
          <section class="api-docs-nav-group">
            <h2>{group.name}</h2>
            <ul>
              {#each group.tags as tag}
                <li>
                  <a
                    class:active={selectedDocs.activeHref === tag.href}
                    class="api-docs-nav-tag"
                    data-sveltekit-noscroll
                    href={tag.href}
                    onclick={rememberSidebarScrollPosition}
                  >
                    {tag.displayName}
                  </a>
                  <ul class="api-docs-nav-operations">
                    {#each tag.operations as operation}
                      <li>
                        <a
                          class:active={selectedDocs.activeHref === operation.href}
                          class="api-docs-nav-operation"
                          data-sveltekit-noscroll
                          href={operation.href}
                          onclick={rememberSidebarScrollPosition}
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
    </aside>

    <div id="api-reference" class="api-reference min-h-[42rem] overflow-hidden rounded-lg border border-base-300 bg-base-100">
      <div class="p-6">
        <p class="text-base-content/60 text-sm">{data.copy.common.loading}</p>
      </div>
    </div>
  </div>
</section>
