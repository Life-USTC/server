<script lang="ts">
import { onMount } from "svelte";
import SwaggerUIBundle from "swagger-ui-dist/swagger-ui-bundle";
import { OPENAPI_SPEC_PUBLIC_PATH } from "$lib/openapi/spec";
import "./api-docs-swagger.css";
import "swagger-ui-dist/swagger-ui.css";
import PageHeader from "$lib/components/PageHeader.svelte";
import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";

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

export let data: PageData;

const specPath = OPENAPI_SPEC_PUBLIC_PATH;
const fallbackPaths = [
  "/api/sections",
  "/api/courses",
  "/api/teachers",
  "/api/semesters/current",
];

onMount(() => {
  const container = document.getElementById("swagger-ui");
  if (!container) return;
  container.replaceChildren();
  SwaggerUIBundle({
    url: specPath,
    dom_id: "#swagger-ui",
    deepLinking: true,
  });
});
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

  <Card.Root class="overflow-hidden">
    <div id="swagger-ui" class="min-h-[36rem]">
      <div class="p-6">
        <p class="text-base-content/60 text-sm">{data.copy.common.loading}</p>
        <ul class="mt-4 grid gap-2 font-mono text-sm">
          {#each fallbackPaths as path}
            <li>{path}</li>
          {/each}
        </ul>
      </div>
    </div>
  </Card.Root>
</section>
