<script lang="ts">
import { legacyPageStore } from "@/lib/navigation/legacy-page-stores";
import RouteErrorCard from "./_components/RouteErrorCard.svelte";

const _page = legacyPageStore();

function contextualBackHref(pathname: string) {
  if (/^\/catalog\/courses\/[^/]+/.test(pathname)) return "/catalog/courses";
  if (/^\/catalog\/sections\/[^/]+/.test(pathname)) return "/catalog/sections";
  if (/^\/catalog\/teachers\/[^/]+/.test(pathname)) return "/catalog/teachers";
  if (pathname.startsWith("/account/settings"))
    return "/account/settings/profile";

  return "/";
}

$: backHref = contextualBackHref($_page.url.pathname);
</script>

<RouteErrorCard backHref={backHref} />
