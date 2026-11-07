import { untrack } from "svelte";
import { afterNavigate } from "$app/navigation";

function filterDraft(filters: Record<string, string | null | undefined>) {
  return Object.fromEntries(
    Object.entries(filters).map(([key, value]) => [key, value ?? ""]),
  );
}

/** Keep edits newer than the native GET submission that just completed. */
export function createFilterDraft(
  applied: () => Record<string, string | null | undefined>,
) {
  let values = $state(filterDraft(untrack(applied)));
  const submissions = new WeakMap<SubmitEvent, Record<string, string>>();
  const removals = new WeakMap<MouseEvent, Record<string, string>>();

  afterNavigate((navigation) => {
    if (navigation.shallow || navigation.type === "enter") return;
    const submitted =
      navigation.type === "form"
        ? submissions.get(navigation.event)
        : navigation.type === "link"
          ? removals.get(navigation.event)
          : undefined;
    const newer = submitted
      ? Object.fromEntries(
          Object.entries(values).filter(
            ([name, value]) => value !== (submitted[name] ?? ""),
          ),
        )
      : {};
    values = { ...filterDraft(applied()), ...newer };
  });

  return {
    get values() {
      return values;
    },
    update(patch: Record<string, string>) {
      values = { ...values, ...patch };
    },
    /** A chip is a targeted applied intent, while other URL navigation resets drafts. */
    remove(event: MouseEvent, names: readonly string[]) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const baseline = filterDraft(applied());
      for (const name of names) delete baseline[name];
      removals.set(event, baseline);
      values = Object.fromEntries(
        Object.entries(values).filter(([name]) => !names.includes(name)),
      );
    },
    submit(event: SubmitEvent) {
      submissions.set(event, { ...values });
    },
  };
}
