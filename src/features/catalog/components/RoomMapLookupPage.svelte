<script lang="ts">
import MapPinnedIcon from "@lucide/svelte/icons/map-pinned";
import RoomMapPreview from "@/features/rooms/components/RoomMapPreview.svelte";
import type { RoomMapCopy } from "@/features/rooms/lib/room-map-types";
import CollectionPage from "$lib/components/CollectionPage.svelte";
import {
  toolbarControlClass,
  toolbarFieldClass,
} from "$lib/components/toolbar-control";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";

export let copy: RoomMapCopy;
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
      <Button type="submit" class={toolbarControlClass}>
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
    <Empty.Root class="min-h-40 rounded-none border-0 p-0">
      <Empty.Header>
        <Empty.Description>{copy.empty}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/if}
</CollectionPage>
