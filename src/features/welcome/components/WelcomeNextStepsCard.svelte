<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import type { WelcomeCopy } from "./welcome-component-types";

export let importMessage: string;
export let onOpenBulkImport: () => void;
export let welcomeCopy: WelcomeCopy;
</script>

<Card.Root class="border-base-300 bg-base-100 lg:sticky lg:top-20 lg:h-fit">
  <Card.Header>
    <Card.Title class="text-lg">{welcomeCopy.nextStepsTitle}</Card.Title>
    <Card.Description>
      {welcomeCopy.nextStepsDescription}
    </Card.Description>
  </Card.Header>
  <Card.Content class="grid gap-2">
    {#if importMessage}
      <Alert>
        <span>{importMessage}</span>
      </Alert>
    {/if}
    <Button class="justify-start" href="/sections" variant="outline">{welcomeCopy.browseSections}</Button>
    <Button class="justify-start" href="/courses" variant="outline">{welcomeCopy.browseCourses}</Button>
    <Button class="justify-start" type="button" variant="outline" onclick={onOpenBulkImport}>{welcomeCopy.bulkImportCta}</Button>
  </Card.Content>
</Card.Root>
