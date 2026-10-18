/**
 * Shared marketing composition for Bot / MCP / CLI usage guides.
 *
 * Recipe: icon container → title → one-line blurb → primary CTA →
 * three equal-height example cards → numbered steps.
 */
export const usageMarketingPageClass = "grid gap-14 pb-10 sm:gap-16";

export const usageMarketingHeroShellClass =
  "relative -mx-4 -mt-4 bg-[radial-gradient(120%_80%_at_10%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_55%),linear-gradient(180deg,color-mix(in_oklab,var(--muted)_55%,transparent),var(--background))] sm:-mx-5 lg:-mx-6";

export const usageMarketingHeroGridClass =
  "grid items-center gap-10 px-4 py-10 sm:px-5 sm:py-14 lg:gap-14 lg:px-6 lg:py-16";

export const usageMarketingHeroCopyClass = "hero-copy grid max-w-xl gap-6";

export const usageMarketingIconClass =
  "flex size-14 items-center justify-center rounded-2xl border border-border bg-primary/10 text-primary shadow-sm";

export const usageMarketingIconGlyphClass = "size-7";

export const usageMarketingTitleClass =
  "text-balance font-semibold text-4xl tracking-tight sm:text-5xl lg:text-6xl";

export const usageMarketingBlurbClass =
  "max-w-lg text-pretty text-base text-muted-foreground sm:text-lg";

export const usageMarketingCtaRowClass = "flex flex-wrap items-center gap-3";

export const usageMarketingPrimaryCtaClass = "h-10 w-fit no-underline";

export const usageMarketingSectionTitleClass =
  "font-semibold text-2xl tracking-tight sm:text-3xl";

export const usageMarketingExampleGridClass =
  "grid gap-5 md:grid-cols-3 md:items-stretch";

export const usageMarketingExampleCardClass =
  "grid h-full min-w-0 content-start overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-sm";

export const usageMarketingExampleCardBodyClass =
  "grid h-full gap-5 p-5 sm:p-6";

export const usageMarketingStepGridClass =
  "grid gap-10 py-10 lg:grid-cols-3 lg:items-stretch lg:gap-8 lg:py-14";

export const usageMarketingStepColumnClass =
  "grid h-full min-w-0 content-start gap-6";

export const usageMarketingStepIndexClass =
  "font-mono text-muted-foreground text-sm";

export const usageMarketingStepTitleClass =
  "text-balance font-semibold text-xl leading-8";

export function usageMarketingStepIndex(index: number): string {
  return String(index + 1).padStart(2, "0");
}
