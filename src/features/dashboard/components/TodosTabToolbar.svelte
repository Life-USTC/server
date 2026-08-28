<script lang="ts">
import Plus from "@lucide/svelte/icons/plus";
import type {
  DashboardTodosCopy,
  TodoFilter,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { Button } from "$lib/components/ui/button/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";

export let createTodoError: string;
export let showCreateTodo: boolean;
export let todoFilter: TodoFilter;
export let onTodoFilterChange: (value: TodoFilter) => void;
export let todosCopy: DashboardTodosCopy;
</script>

<div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
  <div class="min-w-0 md:flex md:flex-wrap md:items-center md:gap-2 md:justify-start">
    <ToggleGroup.Root
      aria-label={String(todosCopy.title)}
      class="w-full min-w-0 md:w-fit"
      type="single"
      value={todoFilter}
      variant="outline"
      onValueChange={(value) => {
        if (
          value === "incomplete" ||
          value === "completed" ||
          value === "all"
        ) {
          onTodoFilterChange(value);
          return;
        }
        onTodoFilterChange(todoFilter);
      }}
    >
      <ToggleGroup.Item class="h-11 min-w-0 flex-1 text-xs md:h-8 md:flex-none md:text-sm" value="incomplete">
        {todosCopy.filterIncomplete}
      </ToggleGroup.Item>
      <ToggleGroup.Item class="h-11 min-w-0 flex-1 text-xs md:h-8 md:flex-none md:text-sm" value="completed">
        {todosCopy.filterCompleted}
      </ToggleGroup.Item>
      <ToggleGroup.Item class="h-11 min-w-0 flex-1 text-xs md:h-8 md:flex-none md:text-sm" value="all">
        {todosCopy.filterAll}
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  </div>
  <div class="flex items-center gap-2 md:justify-end">
    <Button
      aria-label={String(todosCopy.addButton)}
      class="size-11 md:h-8 md:w-auto md:min-w-28"
      data-testid="dashboard-todos-add"
      type="button"
      onclick={() => {
        createTodoError = "";
        showCreateTodo = true;
      }}
    >
      <Plus class="md:hidden" data-icon="inline-start" />
      <span class="hidden md:inline">{todosCopy.addButton}</span>
    </Button>
  </div>
</div>
