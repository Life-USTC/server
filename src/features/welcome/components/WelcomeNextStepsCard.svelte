<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import type { WelcomeCopy } from "./welcome-component-types";

export let importMessage: string;
export let onOpenBulkImport: () => void;
export let welcomeCopy: WelcomeCopy;
</script>

<Card.Root class="lg:sticky lg:top-20 lg:h-fit">
  <Card.Header>
    <Card.Title>{welcomeCopy.nextStepsTitle}</Card.Title>
    <Card.Description>
      {welcomeCopy.nextStepsDescription}
    </Card.Description>
  </Card.Header>
  <Card.Content class="grid gap-2">
    {#if importMessage}
      <Alert.Root>
        <Alert.Description>{importMessage}</Alert.Description>
      </Alert.Root>
    {/if}
    <Button class="justify-start" href="/catalog/sections" variant="outline">{welcomeCopy.browseSections}</Button>
    <Button class="justify-start" href="/catalog/courses" variant="outline">{welcomeCopy.browseCourses}</Button>
    <Button class="justify-start" type="button" variant="outline" onclick={onOpenBulkImport}>{welcomeCopy.bulkImportCta}</Button>
    <div class="mt-3 grid gap-3 border-t pt-4">
      <div>
        <p class="font-medium text-sm">{welcomeCopy.guideWorkspaceTitle}</p>
        <p class="text-muted-foreground text-xs">{welcomeCopy.guideWorkspaceDescription}</p>
      </div>
      <div>
        <p class="font-medium text-sm">{welcomeCopy.guidePlanningTitle}</p>
        <p class="text-muted-foreground text-xs">{welcomeCopy.guidePlanningDescription}</p>
      </div>
      <div>
        <p class="font-medium text-sm">{welcomeCopy.guideAccountTitle}</p>
        <p class="text-muted-foreground text-xs">{welcomeCopy.guideAccountDescription}</p>
      </div>
    </div>
  </Card.Content>
</Card.Root>
