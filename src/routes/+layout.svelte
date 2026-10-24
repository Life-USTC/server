<script lang="ts">
import appIconUrl from "#lib/assets/life-ustc-icon-192.png";
import AppShell from "#lib/components/shell/AppShell.svelte";
import { Toaster } from "#lib/components/ui/sonner/index.js";
import { page as routePage } from "$app/state";
import "./svelte.css";
import type { LayoutData } from "./$types";

interface Props {
  data: LayoutData;
  children?: import("svelte").Snippet;
}

let { data, children }: Props = $props();

let socialMetadata = $derived(routePage.data.socialMetadata);
let documentTitle = $derived(socialMetadata?.title ?? "Life@USTC");
</script>


<svelte:head>
  {#if !data.demo}
    <script
      async
      src="https://www.googletagmanager.com/gtag/js?id=G-JNK35J2Q3R"
    ></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        // biome-ignore lint/complexity/noArguments: Keep Google's canonical gtag bootstrap.
        dataLayer.push(arguments);
      }
      gtag("js", new Date());
      gtag("config", "G-JNK35J2Q3R");
    </script>
  {/if}
  <title>{documentTitle}</title>
  <link
    rel="icon"
    type="image/png"
    sizes="192x192"
    href={appIconUrl}
  />
  <link rel="canonical" href={socialMetadata.canonicalUrl} />
  <meta name="description" content={socialMetadata.description} />
  <meta property="og:title" content={socialMetadata.title} />
  <meta property="og:description" content={socialMetadata.description} />
  <meta property="og:type" content={socialMetadata.type} />

  <meta
    property="og:url"
    content={socialMetadata.canonicalUrl}
  />

  <meta
    property="og:site_name"
    content={socialMetadata.siteName}
  />

  <meta
    property="og:locale"
    content={socialMetadata.locale}
  />

  <meta
    property="og:locale:alternate"
    content={socialMetadata.alternateLocale}
  />
  <meta property="og:image" content={socialMetadata.image.url} />
  <meta property="og:image:type" content={socialMetadata.image.type} />
  <meta property="og:image:width" content={socialMetadata.image.width} />
  <meta property="og:image:height" content={socialMetadata.image.height} />
  <meta property="og:image:alt" content={socialMetadata.image.alt} />
  <meta name="twitter:card" content={socialMetadata.twitterCard} />
  <meta name="twitter:title" content={socialMetadata.title} />
  <meta name="twitter:description" content={socialMetadata.description} />
  <meta name="twitter:image" content={socialMetadata.image.url} />
  <meta name="twitter:image:alt" content={socialMetadata.image.alt} />
</svelte:head>

<AppShell data={data}>{@render children?.()}</AppShell>

<Toaster mobileOffset={{ left: "1rem", right: "1rem" }} position="bottom-right" />
