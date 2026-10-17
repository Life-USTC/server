import { type Readable, toStore } from "svelte/store";
import type { Navigation } from "$app/navigation";
import type { Page } from "$app/state";
import { navigating as navigatingState, page as pageState } from "$app/state";

/**
 * SvelteKit 3 removed `$app/stores`, and the `$app/state` replacements are
 * only reactive under runes: a legacy component (`export let`, `$:`) reading
 * them would keep the values from its first render after every navigation.
 * These factories rebuild the removed stores on top of `$app/state` so legacy
 * components keep their `$store` semantics unchanged.
 *
 * Call them during component initialization (server-side rendering resolves
 * the request context there). New code should use runes and read `$app/state`
 * directly instead.
 */
export function legacyPageStore(): Readable<Page> {
  return toStore(() => ({
    url: pageState.url,
    params: pageState.params,
    route: pageState.route,
    status: pageState.status,
    error: pageState.error,
    data: pageState.data,
    state: pageState.state,
    shallow: pageState.shallow,
    form: pageState.form,
  }));
}

/** `Navigation | null`, matching the shape of the removed `navigating` store. */
export function legacyNavigatingStore(): Readable<Navigation | null> {
  return toStore(() =>
    navigatingState.to ? ({ ...navigatingState } as Navigation) : null,
  );
}
