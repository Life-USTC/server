<script lang="ts">
import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
import MapPinnedIcon from "@lucide/svelte/icons/map-pinned";
import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
import ZoomInIcon from "@lucide/svelte/icons/zoom-in";
import ZoomOutIcon from "@lucide/svelte/icons/zoom-out";
import { onDestroy, onMount } from "svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import * as Popover from "$lib/components/ui/popover/index.js";
import { Skeleton } from "$lib/components/ui/skeleton/index.js";
import { cn } from "$lib/utils.js";
import {
  formatRoomMapCopy,
  isRoomMapResult,
  type RoomMapCopy,
  type RoomMapResult,
} from "../lib/room-map-types";

export let code = "";
export let copy: RoomMapCopy;
export let loadOnMount = false;
export let openOnLoad = false;
export let className = "";

let map: RoomMapResult | null = null;
let loading = false;
let failed = false;
let previewOpen = false;
let dialogOpen = false;
let zoom = 1;
let requestCode = "";
let requestController: AbortController | null = null;

$: normalizedCode = code.trim();
$: imageUrl = map?.imageUrl ?? map?.sourceImageUrl ?? null;
$: statusLabel = map ? statusCopy(map.status) : "";
$: triggerLabel = formatRoomMapCopy(copy.triggerLabel, normalizedCode);
$: mapAlt = formatRoomMapCopy(copy.mapAlt, normalizedCode);
$: dialogTitle = formatRoomMapCopy(copy.dialogTitle, normalizedCode);
$: dialogDescription = formatRoomMapCopy(
  copy.dialogDescription,
  normalizedCode,
);

onMount(() => {
  if (loadOnMount) {
    if (openOnLoad) previewOpen = true;
    void loadMap();
  }
});

onDestroy(() => {
  requestController?.abort();
});

function statusCopy(status: RoomMapResult["status"]) {
  if (status === "highlighted") return copy.highlighted;
  if (status === "overview") return copy.overview;
  return copy.unavailable;
}

function handlePreviewIntent() {
  previewOpen = true;
  void loadMap();
}

function handleTriggerClick() {
  void loadMap();
  if (imageUrl) {
    previewOpen = false;
    dialogOpen = true;
    zoom = 1;
  }
}

async function loadMap() {
  const requestedCode = normalizedCode;
  if (!requestedCode || (loading && requestCode === requestedCode)) return;
  if (map?.code === requestedCode || (failed && requestCode === requestedCode))
    return;

  requestController?.abort();
  requestController = new AbortController();
  requestCode = requestedCode;
  loading = true;
  failed = false;
  map = null;

  try {
    const response = await fetch(
      `/api/catalog/rooms/${encodeURIComponent(requestedCode)}/map`,
      {
        headers: { accept: "application/json" },
        signal: requestController.signal,
      },
    );
    if (!response.ok)
      throw new Error(`Room map request failed: ${response.status}`);
    const body: unknown = await response.json();
    if (!isRoomMapResult(body)) throw new Error("Invalid room map response");
    if (requestCode === requestedCode) map = body;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    if (requestCode === requestedCode) failed = true;
  } finally {
    if (requestCode === requestedCode) loading = false;
  }
}

function openMap() {
  void loadMap();
  if (imageUrl) {
    previewOpen = false;
    dialogOpen = true;
    zoom = 1;
  }
}

function closeDialog() {
  dialogOpen = false;
  zoom = 1;
}

function handleWheel(event: WheelEvent) {
  if (!event.ctrlKey) return;
  event.preventDefault();
  zoom = Math.min(3, Math.max(0.75, zoom + (event.deltaY < 0 ? 0.1 : -0.1)));
}
</script>

<span class={cn("inline-flex max-w-full", className)} data-testid="room-map-preview">
  <Popover.Root bind:open={previewOpen}>
    <Popover.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          aria-label={triggerLabel}
          class="max-w-full px-1.5"
          size="sm"
          type="button"
          variant="link"
          onfocus={handlePreviewIntent}
          onpointerenter={handlePreviewIntent}
          onclick={handleTriggerClick}
        >
          <MapPinnedIcon data-icon="inline-start" aria-hidden="true" />
          <span class="truncate">{normalizedCode}</span>
        </Button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content
      align="start"
      class="w-[min(24rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]"
      data-testid="room-map-preview-popover"
      sideOffset={8}
    >
      <Popover.Title class="sr-only">{dialogTitle}</Popover.Title>
      <div class="grid gap-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="truncate font-medium">{normalizedCode}</p>
            {#if map?.building || map?.floor}
              <p class="text-muted-foreground text-xs">
                {[map?.building, map?.floor].filter(Boolean).join(" · ")}
              </p>
            {/if}
          </div>
          {#if statusLabel}<Badge variant="secondary">{statusLabel}</Badge>{/if}
        </div>

        {#if loading}
          <Skeleton class="aspect-video w-full rounded-md" />
          <p class="text-muted-foreground text-xs">{copy.loading}</p>
        {:else if failed}
          <Alert.Root variant="destructive">
            <Alert.Description>{copy.fetchError}</Alert.Description>
          </Alert.Root>
        {:else if map?.status === "unavailable" || !imageUrl}
          <Alert.Root>
            <Alert.Description>{copy.unavailableDescription}</Alert.Description>
          </Alert.Root>
        {:else}
          <img
            alt={mapAlt}
            class="max-h-64 w-full rounded-md border border-border object-contain"
            decoding="async"
            loading="lazy"
            src={imageUrl}
          />
          {#if map?.status === "overview"}
            <p class="text-muted-foreground text-xs">{copy.overview}</p>
          {/if}
        {/if}

        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap gap-2">
            <Button
              disabled={!imageUrl}
              size="sm"
              type="button"
              variant="outline"
              onclick={openMap}
            >
              <ZoomInIcon data-icon="inline-start" />
              {copy.openMap}
            </Button>
            {#if map?.sourceImageUrl}
              <Button
                href={map.sourceImageUrl}
                rel="noopener noreferrer"
                size="sm"
                target="_blank"
                variant="ghost"
              >
                <ExternalLinkIcon data-icon="inline-start" />
                {copy.sourceImage}
              </Button>
            {/if}
          </div>
        </div>
      </div>
    </Popover.Content>
  </Popover.Root>

  <Dialog.Root bind:open={dialogOpen} onOpenChange={(open) => (dialogOpen = open)}>
    <Dialog.Content
      class="flex max-h-[calc(100dvh-2rem)] max-w-6xl flex-col gap-3 overflow-hidden sm:max-w-6xl"
      data-testid="room-map-dialog"
    >
      <Dialog.Header>
        <Dialog.Title>{dialogTitle}</Dialog.Title>
        <Dialog.Description>{dialogDescription}</Dialog.Description>
      </Dialog.Header>

      {#if imageUrl}
        <div
          class="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted/20 p-2"
          onwheel={handleWheel}
        >
          <div class="flex min-h-full min-w-full items-start justify-center">
            <img
              alt={mapAlt}
              class="max-h-[calc(100dvh-14rem)] max-w-none origin-top object-contain transition-transform"
              decoding="async"
              src={imageUrl}
              style={`transform: scale(${zoom})`}
            />
          </div>
        </div>
      {:else}
        <Alert.Root>
          <Alert.Description>{copy.unavailableDescription}</Alert.Description>
        </Alert.Root>
      {/if}

      <Dialog.Footer class="flex-wrap justify-between gap-2">
        <div class="flex gap-2">
          <Button
            aria-label={copy.zoomOut}
            disabled={!imageUrl || zoom <= 0.75}
            size="icon-sm"
            type="button"
            variant="outline"
            onclick={() => (zoom = Math.max(0.75, zoom - 0.25))}
          >
            <ZoomOutIcon data-icon="inline-start" />
          </Button>
          <Button
            aria-label={copy.zoomIn}
            disabled={!imageUrl || zoom >= 3}
            size="icon-sm"
            type="button"
            variant="outline"
            onclick={() => (zoom = Math.min(3, zoom + 0.25))}
          >
            <ZoomInIcon data-icon="inline-start" />
          </Button>
          <Button
            aria-label={copy.resetZoom}
            disabled={!imageUrl || zoom === 1}
            size="icon-sm"
            type="button"
            variant="ghost"
            onclick={() => (zoom = 1)}
          >
            <RotateCcwIcon data-icon="inline-start" />
          </Button>
        </div>
        <Button type="button" variant="outline" onclick={closeDialog}>{copy.close}</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
</span>
