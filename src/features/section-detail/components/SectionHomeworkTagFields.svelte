<script lang="ts">
import { Checkbox } from "$lib/components/ui/checkbox/index.js";

export let homeworkCopy: {
  tagMajor: string;
  tagTeam: string;
};
</script>

<div class="flex flex-wrap gap-4">
  <label class="inline-flex items-center gap-2 text-sm">
    <Checkbox name="isMajor" />
    <span>{homeworkCopy.tagMajor}</span>
  </label>
  <label class="inline-flex items-center gap-2 text-sm">
    <Checkbox name="requiresTeam" />
    <span>{homeworkCopy.tagTeam}</span>
  </label>
</div>
