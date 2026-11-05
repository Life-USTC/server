import { untrack } from "svelte";
import { afterNavigate } from "$app/navigation";
import { catalogFilterDraft } from "./catalog-filter-view";

/** Keep edits newer than the native GET submission that just completed. */
export function createCatalogFilterDraft(
  applied: () => Record<string, string | null | undefined>,
) {
  let values = $state(catalogFilterDraft(untrack(applied)));
  const submissions = new WeakMap<SubmitEvent, Record<string, string>>();

  afterNavigate((navigation) => {
    if (navigation.shallow || navigation.type === "enter") return;
    const submitted =
      navigation.type === "form"
        ? submissions.get(navigation.event)
        : undefined;
    const newer = submitted
      ? Object.fromEntries(
          Object.entries(values).filter(
            ([name, value]) => value !== (submitted[name] ?? ""),
          ),
        )
      : {};
    values = { ...catalogFilterDraft(applied()), ...newer };
  });

  return {
    get values() {
      return values;
    },
    update(patch: Record<string, string>) {
      values = { ...values, ...patch };
    },
    submit(event: SubmitEvent) {
      submissions.set(event, { ...values });
    },
  };
}
