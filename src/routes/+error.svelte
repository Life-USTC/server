<script lang="ts">
import { page as routePage } from "$app/state";
import RouteErrorCard from "./_components/RouteErrorCard.svelte";

function contextualBackHref(pathname: string) {
  if (/^\/catalog\/courses\/[^/]+/.test(pathname)) return "/catalog/courses";
  if (/^\/catalog\/sections\/[^/]+/.test(pathname)) return "/catalog/sections";
  if (/^\/catalog\/teachers\/[^/]+/.test(pathname)) return "/catalog/teachers";
  if (pathname.startsWith("/account/settings"))
    return "/account/settings/profile";

  return "/";
}

let backHref = $derived(contextualBackHref(routePage.url.pathname));
</script>

<RouteErrorCard backHref={backHref} />
