<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import type { CommentsCopy } from "./comment-component-types";

export let commentCopy: CommentsCopy;
export let hiddenCount: number;
export let signInHref: string;
</script>

<Alert.Root>
  <Alert.Description>{commentCopy.hiddenNotice.replace("{count}", String(hiddenCount))}</Alert.Description>
  <Alert.Action>
    <Button href={signInHref} size="sm" variant="outline">
      {commentCopy.loginToView}
    </Button>
  </Alert.Action>
</Alert.Root>
