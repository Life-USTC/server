import type {
  GlobalSearchResultGroup,
  GlobalSearchResultItem,
} from "@/features/search/server/global-search-types";

export const GLOBAL_SEARCH_LISTBOX_ID = "global-search-listbox";
export const GLOBAL_SEARCH_ITEM_ID_PREFIX = "global-search-item-";

export function flattenSearchGroups(groups: GlobalSearchResultGroup[]) {
  return groups.flatMap((group) => group.items);
}

export function globalSearchItemDomId(itemId: string) {
  return `${GLOBAL_SEARCH_ITEM_ID_PREFIX}${itemId}`;
}

export function moveSearchActiveIndex(
  itemCount: number,
  currentIndex: number,
  direction: "down" | "up",
) {
  if (itemCount <= 0) return -1;

  if (direction === "down") {
    if (currentIndex < itemCount - 1) return currentIndex + 1;
    return currentIndex < 0 ? 0 : currentIndex;
  }

  if (currentIndex <= 0) return -1;
  return currentIndex - 1;
}

export function focusSearchResultItem(
  items: GlobalSearchResultItem[],
  index: number,
  inputElement?: HTMLInputElement | null,
) {
  if (index < 0) {
    inputElement?.focus();
    return;
  }

  const item = items[index];
  if (!item) return;

  const element = document.getElementById(globalSearchItemDomId(item.id));
  if (!(element instanceof HTMLElement)) return;
  element.focus();
  element.scrollIntoView({ block: "nearest" });
}

export function activeItemIdFromIndex(
  items: GlobalSearchResultItem[],
  index: number,
) {
  if (index < 0) return null;
  return items[index]?.id ?? null;
}

export function handleSearchListboxKeydown(input: {
  activeIndex: number;
  event: KeyboardEvent;
  inputElement?: HTMLInputElement | null;
  isInteractive: boolean;
  items: GlobalSearchResultItem[];
  onActiveIndexChange: (index: number) => void;
  onSelect: (item: GlobalSearchResultItem) => void;
}) {
  if (!input.isInteractive || input.items.length === 0) return false;

  const { event, items } = input;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    const nextIndex = moveSearchActiveIndex(
      items.length,
      input.activeIndex,
      "down",
    );
    input.onActiveIndexChange(nextIndex);
    focusSearchResultItem(items, nextIndex, input.inputElement);
    return true;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    const nextIndex = moveSearchActiveIndex(
      items.length,
      input.activeIndex,
      "up",
    );
    input.onActiveIndexChange(nextIndex);
    focusSearchResultItem(items, nextIndex, input.inputElement);
    return true;
  }

  if (event.key === "Enter" && input.activeIndex >= 0) {
    const item = items[input.activeIndex];
    if (!item) return false;
    event.preventDefault();
    input.onSelect(item);
    return true;
  }

  return false;
}
