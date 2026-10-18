<script lang="ts">
import MapPinnedIcon from "@lucide/svelte/icons/map-pinned";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import ResultsEmpty from "#lib/components/ResultsEmpty.svelte";
import {
  toolbarControlClass,
  toolbarFieldClass,
} from "#lib/components/toolbar-control.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import { Input } from "#lib/components/ui/input/index.js";
import RoomMapPreview from "@/features/rooms/components/RoomMapPreview.svelte";
import type { RoomMapCopy } from "@/features/rooms/lib/room-map-types";

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

function selectSample(code: string) {
  input = code;
  selectedRoom = code;
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
    <div class="py-10">
      <ResultsEmpty description={copy.empty} title={copy.emptyTitle}>
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
      </ResultsEmpty>
    </div>
  {/if}
</CollectionPage>
