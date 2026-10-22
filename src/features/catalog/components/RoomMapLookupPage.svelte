<script lang="ts">
import MapPinnedIcon from "@lucide/svelte/icons/map-pinned";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import {
  toolbarControlClass,
  toolbarFieldClass,
} from "#lib/components/toolbar-control.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import { Input } from "#lib/components/ui/input/index.js";
import RoomMapPreview from "@/features/rooms/components/RoomMapPreview.svelte";
import type {
  RoomMapBuilding,
  RoomMapCopy,
} from "@/features/rooms/lib/room-map-types";

export let copy: RoomMapCopy;
export let buildings: RoomMapBuilding[] = [];
export let initialRoom = "";

let input = initialRoom;
let selectedRoom = initialRoom;
let searchRevision = 0;

function submit(event: SubmitEvent) {
  event.preventDefault();
  const room = input.trim();
  selectedRoom = room;
  searchRevision += 1;
}

function selectSample(code: string) {
  input = code;
  selectedRoom = code;
  searchRevision += 1;
}

function roomCountLabel(roomCount: number) {
  return roomCount === 1
    ? copy.roomCountOne
    : copy.roomCount.replace("{count}", String(roomCount));
}

function floorLabel(floor: string) {
  return copy.floorName.replace("{floor}", floor);
}
</script>

<svelte:head>
  <title>{copy.title} - Life@USTC</title>
</svelte:head>

<CollectionPage description={copy.subtitle} title={copy.title}>
  {#snippet toolbar()}
    <form
      aria-label={copy.searchLabel}
      class="flex items-end gap-2"
      onsubmit={submit}
    >
      <Field.Field class="min-w-0 flex-1">
        <Field.FieldLabel for="room-map-code">{copy.searchLabel}</Field.FieldLabel>
        <Input
          id="room-map-code"
          class={toolbarFieldClass}
          bind:value={input}
          placeholder={copy.placeholder}
          maxlength={64}
          autocomplete="off"
          spellcheck="false"
        />
      </Field.Field>
      <Button
        type="submit"
        class={toolbarControlClass}
        variant="default"
      >
        <MapPinnedIcon data-icon="inline-start" aria-hidden="true" />
        {copy.submit}
      </Button>
    </form>
  {/snippet}

  {#if selectedRoom}
    {#key `${searchRevision}:${selectedRoom}`}
      <RoomMapPreview
        code={selectedRoom}
        {copy}
        className="w-full"
        loadOnMount={true}
        inline={true}
      />
    {/key}
  {:else}
    <CollectionEmpty
      description={copy.empty}
      title={copy.emptyTitle}
      variant="setup"
    >
      {#if copy.sampleRooms.length > 0}
        <div class="grid gap-2" data-testid="room-map-sample-chips">
          <p class="text-muted-foreground text-sm">{copy.sampleGuidance}</p>
          <div class="flex flex-wrap gap-2">
            {#each copy.sampleRooms as code (code)}
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="font-mono"
                data-testid="room-map-sample-chip"
                onclick={() => selectSample(code)}
              >
                {code}
              </Button>
            {/each}
          </div>
        </div>
      {/if}
    </CollectionEmpty>

    {#if buildings.length > 0}
      <section class="grid gap-3" data-testid="room-map-building-index">
        <div class="grid gap-1">
          <h2 class="font-medium text-sm">{copy.browseTitle}</h2>
          <p class="text-muted-foreground text-sm">{copy.browseGuidance}</p>
        </div>
        <div class="grid gap-3 md:block md:columns-2 md:gap-3 xl:columns-3">
          {#each buildings as entry (entry.building)}
            <section
              class="grid break-inside-avoid content-start gap-2 rounded-md border border-border p-3 md:mb-3"
              data-testid="room-map-building"
            >
              <div class="flex flex-wrap items-baseline justify-between gap-x-2">
                <h3 class="font-medium text-sm">{entry.building}</h3>
                <span class="text-muted-foreground text-xs">
                  {roomCountLabel(entry.roomCount)}
                </span>
              </div>
              {#each entry.floors as floor (floor.floor)}
                <div class="grid gap-1.5">
                  <p class="text-muted-foreground text-xs">{floorLabel(floor.floor)}</p>
                  <div class="flex flex-wrap gap-1.5">
                    {#each floor.codes as code (code)}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        class="font-mono"
                        data-testid="room-map-building-room"
                        onclick={() => selectSample(code)}
                      >
                        {code}
                      </Button>
                    {/each}
                  </div>
                </div>
              {/each}
            </section>
          {/each}
        </div>
      </section>
    {/if}
  {/if}
</CollectionPage>
