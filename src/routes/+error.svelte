<script lang="ts">
import { page as _page } from "$app/stores";
import RouteErrorCard from "./_components/RouteErrorCard.svelte";

function contextualBackHref(pathname: string) {
  if (/^\/courses\/[^/]+/.test(pathname)) return "/courses";
  if (/^\/sections\/[^/]+/.test(pathname)) return "/sections";
  if (/^\/teachers\/[^/]+/.test(pathname)) return "/teachers";
  if (pathname.startsWith("/settings")) return "/settings";
  return "/";
}

$: backHref = contextualBackHref($_page.url.pathname);
</script>

<RouteErrorCard {backHref} />
