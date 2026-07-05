<script lang="ts">
import LayoutGrid from "@lucide/svelte/icons/layout-grid";
import List from "@lucide/svelte/icons/list";
import type {
  DashboardTodosCopy,
  TodoFilter,
  TodoView,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { Button } from "$lib/components/ui/button/index.js";
import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";

export let createTodoError: string;
export let setTodoView: (view: TodoView) => void;
export let showCreateTodo: boolean;
export let todoFilter: TodoFilter;
export let todosCopy: DashboardTodosCopy;
export let todoView: TodoView;
</script>

<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
  <div class="flex flex-wrap items-center gap-2 md:justify-start">
    <ToggleGroup.Root
      aria-label={String(todosCopy.viewMode)}
      type="single"
      value={todoView}
      variant="outline"
      onValueChange={(value) => {
        if (value === "cards" || value === "list") setTodoView(value);
      }}
    >
      <ToggleGroup.Item value="cards">
        <LayoutGrid data-icon="inline-start" />
        {todosCopy.cardView}
      </ToggleGroup.Item>
      <ToggleGroup.Item value="list">
        <List data-icon="inline-start" />
        {todosCopy.listView}
      </ToggleGroup.Item>
    </ToggleGroup.Root>
    <ToggleGroup.Root
      aria-label={String(todosCopy.title)}
      type="single"
      value={todoFilter}
      variant="outline"
      onValueChange={(value) => {
        if (
          value === "incomplete" ||
          value === "completed" ||
          value === "all"
        ) {
          todoFilter = value;
        }
      }}
    >
      <ToggleGroup.Item value="incomplete">
        {todosCopy.filterIncomplete}
      </ToggleGroup.Item>
      <ToggleGroup.Item value="completed">
        {todosCopy.filterCompleted}
      </ToggleGroup.Item>
      <ToggleGroup.Item value="all">
        {todosCopy.filterAll}
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  </div>
  <div class="flex flex-wrap items-center gap-2 md:justify-end">
    <Button
      class="h-9 min-w-28"
      type="button"
      onclick={() => {
        createTodoError = "";
        showCreateTodo = true;
      }}
    >
      {todosCopy.addButton}
    </Button>
  </div>
</div>
