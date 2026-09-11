<script lang="ts">
import MapPinnedIcon from "@lucide/svelte/icons/map-pinned";
import RoomMapPreview from "@/features/rooms/components/RoomMapPreview.svelte";
import type { RoomMapCopy } from "@/features/rooms/lib/room-map-types";
import PageHeader from "$lib/components/PageHeader.svelte";
import Panel from "$lib/components/Panel.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";

export let copy: RoomMapCopy;
export let initialRoom = "";

let input = initialRoom;
let selectedRoom = initialRoom;

function submit(event: SubmitEvent) {
  event.preventDefault();
  const room = input.trim();
  selectedRoom = room;
}
</script>

<svelte:head>
  <title>{copy.title} - Life@USTC</title>
</svelte:head>

<div class="page-frame">
  <section class="grid gap-5">
    <PageHeader description={copy.subtitle} title={copy.title} />

    <Panel>
      <form
        aria-label={copy.searchLabel}
        class="flex flex-col gap-3 sm:flex-row sm:items-end"
        onsubmit={submit}
      >
        <Field.Field class="min-w-0 flex-1">
          <Field.FieldLabel for="room-map-code">{copy.searchLabel}</Field.FieldLabel>
          <Input
            id="room-map-code"
            bind:value={input}
            placeholder={copy.placeholder}
            maxlength={64}
            autocomplete="off"
            spellcheck="false"
          />
        </Field.Field>
        <Button type="submit">
          <MapPinnedIcon data-icon="inline-start" aria-hidden="true" />
          {copy.submit}
        </Button>
      </form>
    </Panel>

    {#if selectedRoom}
      {#key selectedRoom}
        <Panel>
          <RoomMapPreview
            code={selectedRoom}
            {copy}
            className="w-full"
            loadOnMount={true}
            inline={true}
          />
        </Panel>
      {/key}
    {:else}
      <Empty.Root class="min-h-40">
        <Empty.Header>
          <Empty.Description>{copy.empty}</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </section>
</div>
