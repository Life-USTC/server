<script lang="ts">
import type { DashboardOverviewLinkItem } from "@/features/dashboard/lib/dashboard-controller-helpers";

export let link: DashboardOverviewLinkItem;
export let linkIconLabel: (icon: string) => string;
export let reserveActionSpace = false;
export let variant: "card" | "row" = "card";

$: buttonClass =
  variant === "row"
    ? `flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left ${reserveActionSpace ? "pr-16" : ""}`
    : `flex min-h-20 w-full items-start gap-3 px-3 py-3 text-left ${reserveActionSpace ? "pr-16" : ""}`;
$: contentClass =
  variant === "row"
    ? "min-w-0 sm:grid sm:grid-cols-[minmax(10rem,16rem)_1fr] sm:items-center sm:gap-4"
    : "flex min-w-0 flex-col gap-1";
$: titleClass =
  variant === "row"
    ? "line-clamp-1 font-semibold"
    : "line-clamp-2 font-semibold";
$: descriptionClass =
  variant === "row"
    ? "line-clamp-1 text-base-content/60 text-sm"
    : "line-clamp-2 text-base-content/60 text-sm";
</script>

<form
  action="/api/dashboard-links/visit"
  method="POST"
  rel="noopener"
  target="_blank"
>
  <input name="slug" type="hidden" value={link.slug} />
  <button class={buttonClass} type="submit">
    <span
      class="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-base-300 bg-base-200 font-semibold text-[0.6875rem] text-primary"
      aria-hidden="true"
    >
      {linkIconLabel(link.icon)}
    </span>
    <div class={contentClass}>
      <div class={titleClass}>{link.title}</div>
      <p class={descriptionClass}>
        {link.description}
      </p>
    </div>
  </button>
</form>
