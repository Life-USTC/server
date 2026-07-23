<script lang="ts">
import type { Action } from "svelte/action";
import * as Tooltip from "$lib/components/ui/tooltip/index.js";
import { cn } from "$lib/utils.js";

export let text: string | number | null | undefined;
export let lines: 1 | 2 = 1;
export let preserveWhitespace = false;

let className = "";
let open = false;
let overflowing = false;
let interactiveParent: HTMLElement | null = null;

export { className as class };

$: displayText = text == null ? "" : String(text);
$: if (!overflowing) open = false;

const observeOverflow: Action<HTMLSpanElement, string> = (node) => {
  const parent = node.parentElement?.closest<HTMLElement>(
    "a, button, [role='button'], [tabindex]",
  );
  const measure = () => {
    overflowing =
      node.scrollWidth > node.clientWidth + 1 ||
      node.scrollHeight > node.clientHeight + 1;
  };
  const show = () => {
    measure();
    const firstOverflowingChild = parent
      ? Array.from(
          parent.querySelectorAll<HTMLElement>('[data-slot="truncated-text"]'),
        ).find(
          (child) =>
            child.scrollWidth > child.clientWidth + 1 ||
            child.scrollHeight > child.clientHeight + 1,
        )
      : node;
    if (firstOverflowingChild !== node) return;
    if (!overflowing) return;
    open = true;
  };
  const hide = () => {
    open = false;
  };
  const observer = new ResizeObserver(measure);

  interactiveParent = parent ?? null;
  observer.observe(node);
  parent?.addEventListener("focusin", show);
  parent?.addEventListener("focusout", hide);
  queueMicrotask(measure);

  return {
    update: () => queueMicrotask(measure),
    destroy: () => {
      observer.disconnect();
      if (interactiveParent === parent) interactiveParent = null;
      if (!parent) return;
      parent.removeEventListener("focusin", show);
      parent.removeEventListener("focusout", hide);
    },
  };
};

function triggerProps(props: Record<string, unknown>) {
  const { class: triggerClass, ...rest } = props;
  return {
    ...rest,
    class: cn(
      "block min-w-0 max-w-full overflow-hidden",
      lines === 1
        ? "min-h-[1lh] truncate"
        : cn(
            "min-h-[2lh] line-clamp-2",
            preserveWhitespace
              ? "whitespace-pre-wrap break-words"
              : "whitespace-normal",
          ),
      typeof triggerClass === "string" ? triggerClass : undefined,
      className,
    ),
  };
}
</script>

{#if displayText}
  <Tooltip.Root bind:open disabled={!overflowing}>
    <Tooltip.Trigger tabindex={interactiveParent ? -1 : 0}>
      {#snippet child({ props })}
        <span
          {...triggerProps(props)}
          data-slot="truncated-text"
          use:observeOverflow={displayText}
        >
          {displayText}
        </span>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content
      class={cn(
        "max-w-sm break-words",
        preserveWhitespace ? "whitespace-pre-wrap" : "whitespace-normal",
      )}
    >
      {displayText}
    </Tooltip.Content>
  </Tooltip.Root>
{:else}
  <span
    aria-hidden="true"
    class={cn(
      "block min-w-0 max-w-full",
      lines === 1 ? "min-h-[1lh]" : "min-h-[2lh]",
      className,
    )}
    data-slot="truncated-text-placeholder"
  ></span>
{/if}
