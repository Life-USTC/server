<script lang="ts">
import MapPinnedIcon from "@lucide/svelte/icons/map-pinned";
import { untrack } from "svelte";
import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import {
  toolbarControlClass,
  toolbarFieldClass,
} from "#lib/components/toolbar-control.js";
import * as Accordion from "#lib/components/ui/accordion/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import { Input } from "#lib/components/ui/input/index.js";
import DemoNotice from "@/features/demo/components/DemoNotice.svelte";
import type { DemoView } from "@/features/demo/lib/demo-types";
import RoomMapPreview from "@/features/rooms/components/RoomMapPreview.svelte";
import type {
  RoomMapBuilding,
  RoomMapCopy,
} from "@/features/rooms/lib/room-map-types";
import { goto } from "$app/navigation";

let {
  copy,
  buildings = [],
  initialRoom = "",
  pageDemo = null,
  locale = "",
}: {
  copy: RoomMapCopy;
  buildings?: RoomMapBuilding[];
  initialRoom?: string;
  pageDemo?: DemoView | null;
  locale?: string;
} = $props();
let input = $state(untrack(() => initialRoom));
let rawRoom = $derived(initialRoom.trim());
let selectedRoom = $derived(rawRoom.normalize("NFKC").toUpperCase());
let searchRevision = $state(0);
let openedCampus = $state<string[]>([]);
let openedBuilding = $state<string[]>([]);
let openedFloor = $state<string[]>([]);
let campuses = $derived([
  ...new Set(
    buildings.map((building) => building.campus ?? copy.unknownCampus),
  ),
]);

$effect(() => {
  input = rawRoom;
});
$effect(() => {
  const matching = buildings.find((building) =>
    building.floors.some((floor) => floor.codes.includes(selectedRoom)),
  );
  if (matching) {
    openedCampus = [matching.campus ?? copy.unknownCampus];
    openedBuilding = [matching.building];
    openedFloor = matching.floors
      .filter((floor) => floor.codes.includes(selectedRoom))
      .map((floor) => `${matching.building}:${floor.floor}`);
  } else {
    openedCampus = [];
    openedBuilding = [];
    openedFloor = [];
  }
});
function roomHref(code: string) {
  return `/catalog/rooms?${new URLSearchParams({ room: code.trim() })}`;
}
function submit(event: SubmitEvent) {
  event.preventDefault();
  const room = input.trim();
  if (room === rawRoom) {
    searchRevision += 1;
    return;
  }
  void goto(room ? roomHref(room) : "/catalog/rooms", { reset: false });
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
      method="GET"
      action="/catalog/rooms"
      aria-label={copy.searchLabel}
      class="flex items-end gap-2"
      onsubmit={submit}
    >
      <Field.Field class="min-w-0 flex-1">
        <Field.FieldLabel for="room-map-code">{copy.searchLabel}</Field.FieldLabel>
        <Input
          id="room-map-code"
          name="room"
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

  {#if pageDemo}<DemoNotice demo={pageDemo} locale={locale === "en-us" ? "en-us" : "zh-cn"} />{/if}

  {#if selectedRoom}
    {#key `${rawRoom}:${searchRevision}`}
      <RoomMapPreview
        {pageDemo}
        {locale}
        code={rawRoom}
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
                href={roomHref(code)}
                variant="outline"
                size="sm"
                class="font-mono"
                data-testid="room-map-sample-chip"
              >
                {code}
              </Button>
            {/each}
          </div>
        </div>
      {/if}
    </CollectionEmpty>

  {/if}
  {#if buildings.length > 0}
    <section class="grid gap-3" data-testid="room-map-building-index">
      <div class="grid gap-1">
        <h2 class="font-medium text-sm">{copy.browseTitle}</h2>
        <p class="text-muted-foreground text-sm">{copy.browseGuidance}</p>
      </div>
      <Accordion.Root type="multiple" bind:value={openedCampus}>
        {#each campuses as campus (campus)}
          <Accordion.Item value={campus}>
            <Accordion.Trigger>{campus}</Accordion.Trigger>
            <Accordion.Content>
              <Accordion.Root type="multiple" bind:value={openedBuilding}>
                {#each buildings.filter((building) => (building.campus ?? copy.unknownCampus) === campus) as entry (entry.building)}
                  <Accordion.Item value={entry.building} data-testid="room-map-building">
                    <Accordion.Trigger level={4}>{entry.building} · {roomCountLabel(entry.roomCount)}</Accordion.Trigger>
                    <Accordion.Content>
                      <Accordion.Root type="multiple" bind:value={openedFloor}>
                        {#each entry.floors as floor (floor.floor)}
                          <Accordion.Item value={`${entry.building}:${floor.floor}`}>
                            <Accordion.Trigger level={5}>{floorLabel(floor.floor)}</Accordion.Trigger>
                            <Accordion.Content>
                              <div class="flex flex-wrap gap-2">
                                {#each floor.codes as code (code)}
                                  <Button href={roomHref(code)} variant={code === selectedRoom ? "secondary" : "outline"} size="sm" aria-current={code === selectedRoom ? "location" : undefined} data-testid="room-map-building-room">{code}</Button>
                                {/each}
                              </div>
                            </Accordion.Content>
                          </Accordion.Item>
                        {/each}
                      </Accordion.Root>
                    </Accordion.Content>
                  </Accordion.Item>
                {/each}
              </Accordion.Root>
            </Accordion.Content>
          </Accordion.Item>
        {/each}
      </Accordion.Root>
    </section>
  {/if}
</CollectionPage>
