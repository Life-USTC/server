# shadcn-svelte Class/Style Decision Matrix

## Allowed (Layout)

| Pattern | Example | Rationale |
|---|---|---|
| Sizing | `w-full`, `w-fit`, `min-w-0`, `max-w-md`, `h-[min(70vh,32rem)]`, `size-7` | Components have no container knowledge. |
| Spacing | `p-0`, `px-6`, `py-6`, `gap-2`, `gap-4` | Parent layout responsibility. |
| Flex/Grid layout | `flex`, `flex-col`, `items-start`, `justify-center`, `grid`, `grid-cols-2` | Parent layout responsibility. |
| Positioning | `absolute top-2 right-2`, `lg:sticky lg:top-20` | Component-agnostic layout. |
| Typography alignment | `text-center`, `text-right` | Alignment is layout, not type style. |
| Overflow/scroll | `overflow-hidden`, `min-h-24` | Layout behavior. |
| Accessibility | `sr-only` | Required for a11y, not styling. |

## Convert to Variant or Token (Styling Override)

| Pattern | Example | Action |
|---|---|---|
| Background color | `bg-[#f6f8fa]`, `bg-muted/30`, `bg-background` when used to override component surface | Use component's built-in surface or add a semantic CSS variable if the surface is intentional. |
| Border color/width | `border`, `border-l-4`, `border-border` when overriding default | Prefer `variant="outline"` or theme tokens; remove if redundant. |
| Text color/size/weight | `text-2xl`, `text-sm`, `font-medium`, `text-muted-foreground` on shadcn sub-components | Use component props or semantic tokens; remove typography overrides on `Card.Title`, `Alert.Title`, etc. |
| Radius | `rounded-lg` on components that already have radius | Remove; use theme `--radius` or a component prop if exposed. |
| Shadow | `shadow-sm` etc. | Remove; components handle elevation. |
| Inline style | `style="..."` | Move to a layout wrapper or a CSS custom property. |

## Remediation Tally

Total usages: **625** — keep: **609**, convert: **7**, review: **9**.

| Component | Usages | Convert | Keep | Review |
|---|---|---|---|---|
| table.Cell | 54 | 0 | 54 | 0 |
| button | 47 | 0 | 46 | 1 |
| field.Group | 39 | 0 | 39 | 0 |
| table.Head | 38 | 0 | 38 | 0 |
| empty.Root | 37 | 0 | 37 | 0 |
| item.Root | 36 | 2 | 33 | 1 |
| item.Group | 27 | 0 | 27 | 0 |
| card.Content | 26 | 0 | 26 | 0 |
| item.Content | 22 | 0 | 22 | 0 |
| dialog.Content | 21 | 0 | 21 | 0 |
| badge | 19 | 0 | 18 | 1 |
| item.Description | 19 | 0 | 19 | 0 |
| scroll-area | 19 | 0 | 19 | 0 |
| native-select.Root | 18 | 0 | 18 | 0 |
| field.Label | 15 | 0 | 15 | 0 |
| card.Root | 14 | 0 | 13 | 1 |
| button-group.Root | 13 | 0 | 13 | 0 |
| field.Field | 13 | 0 | 13 | 0 |
| card.Header | 12 | 1 | 11 | 0 |
| field.Legend | 8 | 0 | 8 | 0 |
| item.Actions | 8 | 0 | 8 | 0 |
| item.Footer | 8 | 0 | 8 | 0 |
| skeleton | 8 | 0 | 8 | 0 |
| alert-dialog.Content | 7 | 0 | 7 | 0 |
| empty.Header | 7 | 0 | 7 | 0 |
| avatar.Root | 6 | 0 | 6 | 0 |
| card.Footer | 6 | 0 | 6 | 0 |
| card.Description | 5 | 0 | 5 | 0 |
| card.Title | 4 | 0 | 4 | 0 |
| dropdown-menu.Content | 4 | 0 | 4 | 0 |
| item.Media | 4 | 0 | 3 | 1 |
| item.Title | 4 | 0 | 4 | 0 |
| separator | 4 | 0 | 4 | 0 |
| toggle-group.Root | 4 | 0 | 4 | 0 |
| alert.Description | 3 | 0 | 3 | 0 |
| button-group.Text | 3 | 0 | 3 | 0 |
| field.Title | 3 | 0 | 3 | 0 |
| input-group.Root | 3 | 0 | 3 | 0 |
| table.Row | 3 | 0 | 1 | 2 |
| toggle-group.Item | 3 | 0 | 3 | 0 |
| field.Description | 2 | 0 | 1 | 1 |
| field.Set | 2 | 2 | 0 | 0 |
| radio-group.Root | 2 | 0 | 2 | 0 |
| sidebar.Root | 2 | 2 | 0 | 0 |
| tabs.Content | 2 | 0 | 2 | 0 |
| textarea | 2 | 0 | 2 | 0 |
| alert-dialog.Footer | 1 | 0 | 1 | 0 |
| alert.Root | 1 | 0 | 1 | 0 |
| card.Action | 1 | 0 | 1 | 0 |
| collapsible.Root | 1 | 0 | 1 | 0 |
| dialog.Description | 1 | 0 | 1 | 0 |
| dropdown-menu.CheckboxItem | 1 | 0 | 0 | 1 |
| empty.Content | 1 | 0 | 1 | 0 |
| input | 1 | 0 | 1 | 0 |
| input-group.Button | 1 | 0 | 1 | 0 |
| input-group.Input | 1 | 0 | 1 | 0 |
| input-group.Textarea | 1 | 0 | 1 | 0 |
| input-otp.Root | 1 | 0 | 1 | 0 |
| pagination.Root | 1 | 0 | 1 | 0 |
| popover.Content | 1 | 0 | 1 | 0 |
| sidebar.Header | 1 | 0 | 1 | 0 |
| sidebar.Inset | 1 | 0 | 1 | 0 |
| sidebar.Provider | 1 | 0 | 1 | 0 |
| table.Root | 1 | 0 | 1 | 0 |
| tabs.Root | 1 | 0 | 1 | 0 |

## Annotated Decisions

- `src/features/admin/components/AdminBusDeleteDialog.svelte:27`  
  ```json
  {
    "file": "src/features/admin/components/AdminBusDeleteDialog.svelte",
    "line": 27,
    "tag": "<AlertDialog.Content",
    "classValue": "\"max-w-lg sm:max-w-lg\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminBusHeader.svelte:15`  
  ```json
  {
    "file": "src/features/admin/components/AdminBusHeader.svelte",
    "line": 15,
    "tag": "<Button",
    "classValue": "\"w-full sm:w-auto\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminBusImportDialog.svelte:23`  
  ```json
  {
    "file": "src/features/admin/components/AdminBusImportDialog.svelte",
    "line": 23,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-lg sm:max-w-lg\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminBusSummaryStats.svelte:57`  
  ```json
  {
    "file": "src/features/admin/components/AdminBusSummaryStats.svelte",
    "line": 57,
    "tag": "<Card.Title",
    "classValue": "{stat.valueClass}",
    "styleValue": null,
    "decision": "keep",
    "action": "no class tokens to remediate",
    "reason": "empty or expression-only class value with no static styling tokens"
  }
  ```

- `src/features/admin/components/AdminBusVersions.svelte:29`  
  ```json
  {
    "file": "src/features/admin/components/AdminBusVersions.svelte",
    "line": 29,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminBusVersionsMobileList.svelte:23`  
  ```json
  {
    "file": "src/features/admin/components/AdminBusVersionsMobileList.svelte",
    "line": 23,
    "tag": "<Item.Group",
    "classValue": "\"md:hidden\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminBusVersionsMobileList.svelte:25`  
  ```json
  {
    "file": "src/features/admin/components/AdminBusVersionsMobileList.svelte",
    "line": 25,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminBusVersionsMobileList.svelte:26`  
  ```json
  {
    "file": "src/features/admin/components/AdminBusVersionsMobileList.svelte",
    "line": 26,
    "tag": "<Item.Content",
    "classValue": "\"min-w-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminBusVersionsMobileList.svelte:28`  
  ```json
  {
    "file": "src/features/admin/components/AdminBusVersionsMobileList.svelte",
    "line": 28,
    "tag": "<Item.Description",
    "classValue": "\"break-all\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminBusVersionsMobileList.svelte:30`  
  ```json
  {
    "file": "src/features/admin/components/AdminBusVersionsMobileList.svelte",
    "line": 30,
    "tag": "<Item.Description",
    "classValue": "\"line-clamp-none\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminBusVersionsMobileList.svelte:36`  
  ```json
  {
    "file": "src/features/admin/components/AdminBusVersionsMobileList.svelte",
    "line": 36,
    "tag": "<Item.Footer",
    "classValue": "\"block\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminBusVersionsTable.svelte:33`  
  ```json
  {
    "file": "src/features/admin/components/AdminBusVersionsTable.svelte",
    "line": 33,
    "tag": "<Table.Head",
    "classValue": "\"text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminBusVersionsTable.svelte:65`  
  ```json
  {
    "file": "src/features/admin/components/AdminBusVersionsTable.svelte",
    "line": 65,
    "tag": "<Table.Cell",
    "classValue": "\"p-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminBusVersionsTable.svelte:66`  
  ```json
  {
    "file": "src/features/admin/components/AdminBusVersionsTable.svelte",
    "line": 66,
    "tag": "<Empty.Root",
    "classValue": "\"py-6\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminDashboardPage.svelte:32`  
  ```json
  {
    "file": "src/features/admin/components/AdminDashboardPage.svelte",
    "line": 32,
    "tag": "<Item.Group",
    "classValue": "\"grid gap-2 sm:grid-cols-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentDialog.svelte:45`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentDialog.svelte",
    "line": 45,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-2xl sm:max-w-2xl\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentDialog.svelte:61`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentDialog.svelte",
    "line": 61,
    "tag": "<ScrollArea",
    "classValue": "\"h-[min(62vh,34rem)]\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentDialog.svelte:63`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentDialog.svelte",
    "line": 63,
    "tag": "<Alert.Root",
    "classValue": "\"py-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentPreview.svelte:12`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentPreview.svelte",
    "line": 12,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentPreview.svelte:16`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentPreview.svelte",
    "line": 16,
    "tag": "<Item.Actions",
    "classValue": "\"flex-wrap\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentStatusSection.svelte:23`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentStatusSection.svelte",
    "line": 23,
    "tag": "<Field.Group",
    "classValue": "\"gap-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentStatusSection.svelte:26`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentStatusSection.svelte",
    "line": 26,
    "tag": "<ToggleGroup.Root",
    "classValue": "\"grid w-full md:grid-cols-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentStatusSection.svelte:36`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentStatusSection.svelte",
    "line": 36,
    "tag": "<ToggleGroup.Item",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentSuspensionSection.svelte:27`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentSuspensionSection.svelte",
    "line": 27,
    "tag": "<Field.Group",
    "classValue": "\"grid gap-2 md:grid-cols-[160px_1fr]\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentSuspensionSection.svelte:29`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentSuspensionSection.svelte",
    "line": 29,
    "tag": "<Field.Label",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentSuspensionSection.svelte:30`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentSuspensionSection.svelte",
    "line": 30,
    "tag": "<NativeSelect.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentSuspensionSection.svelte:44`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentSuspensionSection.svelte",
    "line": 44,
    "tag": "<Field.Label",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentSuspensionSection.svelte:55`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentSuspensionSection.svelte",
    "line": 55,
    "tag": "<Field.Field",
    "classValue": "\"md:col-span-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentSuspensionSection.svelte:56`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentSuspensionSection.svelte",
    "line": 56,
    "tag": "<Field.Label",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentTableRow.svelte:23`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentTableRow.svelte",
    "line": 23,
    "tag": "<Table.Row",
    "classValue": "{cn(\n    \"border-l-4\",\n    comment.status === \"active\"\n      ? \"border-l-success\"\n      : comment.status === \"deleted\"\n        ? \"border-l-destructive\"\n        : \"border-l-warning\",\n  )}",
    "styleValue": null,
    "decision": "review",
    "action": "inspect dynamic expression; convert styling tokens to variants or theme tokens",
    "reason": "dynamic class expression may contain styling overrides: border-l-4, border-l-success, border-l-destructive, border-l-warning"
  }
  ```

- `src/features/admin/components/AdminModerationCommentTableRow.svelte:33`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentTableRow.svelte",
    "line": 33,
    "tag": "<Table.Cell",
    "classValue": "\"max-w-md\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentTableRow.svelte:44`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentTableRow.svelte",
    "line": 44,
    "tag": "<Table.Cell",
    "classValue": "\"max-w-sm\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentTableRow.svelte:61`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentTableRow.svelte",
    "line": 61,
    "tag": "<Table.Cell",
    "classValue": "\"text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationComments.svelte:43`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationComments.svelte",
    "line": 43,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-24\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentsMobile.svelte:18`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentsMobile.svelte",
    "line": 18,
    "tag": "<Item.Group",
    "classValue": "\"md:hidden\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentsMobile.svelte:20`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentsMobile.svelte",
    "line": 20,
    "tag": "<Item.Root",
    "classValue": "{`items-start border-l-4 ${comment.status === \"active\" ? \"border-l-success\" : comment.status === \"deleted\" ? \"border-l-destructive\" : \"border-l-warning\"}`}",
    "styleValue": null,
    "decision": "convert",
    "action": "keep layout tokens (items-start); convert styling tokens: border-l-success, border-l-destructive, border-l-warning, border-l-4",
    "reason": "mixes layout and styling tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentsMobile.svelte:26`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentsMobile.svelte",
    "line": 26,
    "tag": "<Item.Content",
    "classValue": "\"min-w-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentsMobile.svelte:31`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentsMobile.svelte",
    "line": 31,
    "tag": "<Item.Description",
    "classValue": "\"line-clamp-3 whitespace-pre-wrap\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationCommentsTable.svelte:30`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationCommentsTable.svelte",
    "line": 30,
    "tag": "<Table.Head",
    "classValue": "\"w-24 text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationDeleteHomeworkDialog.svelte:38`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationDeleteHomeworkDialog.svelte",
    "line": 38,
    "tag": "<AlertDialog.Content",
    "classValue": "\"max-w-md sm:max-w-md\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationDescriptionCards.svelte:23`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationDescriptionCards.svelte",
    "line": 23,
    "tag": "<Item.Group",
    "classValue": "\"md:hidden\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationDescriptionCards.svelte:25`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationDescriptionCards.svelte",
    "line": 25,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationDescriptionCards.svelte:28`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationDescriptionCards.svelte",
    "line": 28,
    "tag": "<Item.Content",
    "classValue": "\"min-w-0 gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationDescriptionCards.svelte:29`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationDescriptionCards.svelte",
    "line": 29,
    "tag": "<Item.Title",
    "classValue": "\"line-clamp-none\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationDescriptionCards.svelte:33`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationDescriptionCards.svelte",
    "line": 33,
    "tag": "<Item.Description",
    "classValue": "\"line-clamp-4 whitespace-pre-wrap\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationDescriptionDialog.svelte:43`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationDescriptionDialog.svelte",
    "line": 43,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-3xl sm:max-w-3xl\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationDescriptionDialog.svelte:52`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationDescriptionDialog.svelte",
    "line": 52,
    "tag": "<Field.Group",
    "classValue": "\"gap-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationDescriptionDialog.svelte:65`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationDescriptionDialog.svelte",
    "line": 65,
    "tag": "<ScrollArea",
    "classValue": "\"h-[min(62vh,34rem)]\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationDescriptionDialog.svelte:66`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationDescriptionDialog.svelte",
    "line": 66,
    "tag": "<Field.Group",
    "classValue": "\"gap-4 px-5 py-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationDescriptionDialog.svelte:79`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationDescriptionDialog.svelte",
    "line": 79,
    "tag": "<Textarea",
    "classValue": "\"min-h-56\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationDescriptionMeta.svelte:26`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationDescriptionMeta.svelte",
    "line": 26,
    "tag": "<Item.Actions",
    "classValue": "\"flex-wrap\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationDescriptionTable.svelte:31`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationDescriptionTable.svelte",
    "line": 31,
    "tag": "<Table.Head",
    "classValue": "\"w-24 text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationDescriptionTable.svelte:37`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationDescriptionTable.svelte",
    "line": 37,
    "tag": "<Table.Cell",
    "classValue": "\"max-w-md\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationDescriptionTable.svelte:45`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationDescriptionTable.svelte",
    "line": 45,
    "tag": "<Table.Cell",
    "classValue": "\"max-w-sm\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationDescriptionTable.svelte:56`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationDescriptionTable.svelte",
    "line": 56,
    "tag": "<Table.Cell",
    "classValue": "\"text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationDescriptions.svelte:59`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationDescriptions.svelte",
    "line": 59,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-24\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationFilters.svelte:54`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationFilters.svelte",
    "line": 54,
    "tag": "<Field.Group",
    "classValue": "{filterGroupClass}",
    "styleValue": null,
    "decision": "keep",
    "action": "no class tokens to remediate",
    "reason": "empty or expression-only class value with no static styling tokens"
  }
  ```

- `src/features/admin/components/AdminModerationFilters.svelte:60`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationFilters.svelte",
    "line": 60,
    "tag": "<NativeSelect.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationFilters.svelte:77`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationFilters.svelte",
    "line": 77,
    "tag": "<NativeSelect.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationFilters.svelte:94`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationFilters.svelte",
    "line": 94,
    "tag": "<NativeSelect.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationFilters.svelte:119`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationFilters.svelte",
    "line": 119,
    "tag": "<Field.Label",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationHeader.svelte:26`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationHeader.svelte",
    "line": 26,
    "tag": "<Button",
    "classValue": "\"w-full sm:w-auto\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationHomeworks.svelte:78`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationHomeworks.svelte",
    "line": 78,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-24\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminModerationSuspensions.svelte:77`  
  ```json
  {
    "file": "src/features/admin/components/AdminModerationSuspensions.svelte",
    "line": 77,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-24\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthAllClients.svelte:23`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthAllClients.svelte",
    "line": 23,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-24\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthAuthPatternPicker.svelte:18`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthAuthPatternPicker.svelte",
    "line": 18,
    "tag": "<ToggleGroup.Root",
    "classValue": "\"grid w-full gap-3 xl:grid-cols-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthAuthPatternPicker.svelte:30`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthAuthPatternPicker.svelte",
    "line": 30,
    "tag": "<ToggleGroup.Item",
    "classValue": "\"h-auto w-full justify-between whitespace-normal p-3 text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthClientCard.svelte:23`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthClientCard.svelte",
    "line": 23,
    "tag": "<Card.Description",
    "classValue": "\"break-all\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthClientCard.svelte:24`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthClientCard.svelte",
    "line": 24,
    "tag": "<Card.Action",
    "classValue": "\"flex flex-wrap justify-end gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthClientCard.svelte:35`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthClientCard.svelte",
    "line": 35,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-3 lg:grid-cols-[220px_1fr_1fr]\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthClientCard.svelte:36`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthClientCard.svelte",
    "line": 36,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthClientCard.svelte:43`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthClientCard.svelte",
    "line": 43,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthClientCard.svelte:44`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthClientCard.svelte",
    "line": 44,
    "tag": "<Item.Content",
    "classValue": "\"min-w-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthClientCard.svelte:50`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthClientCard.svelte",
    "line": 50,
    "tag": "<Button",
    "classValue": "\"shrink-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthClientCard.svelte:68`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthClientCard.svelte",
    "line": 68,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthClientCard.svelte:82`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthClientCard.svelte",
    "line": 82,
    "tag": "<Card.Footer",
    "classValue": "\"flex-wrap justify-between gap-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthClientSection.svelte:63`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthClientSection.svelte",
    "line": 63,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-24\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthClientSectionPagination.svelte:18`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthClientSectionPagination.svelte",
    "line": 18,
    "tag": "<Pagination.Root",
    "classValue": "\"mx-0 w-auto\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthCreateDialog.svelte:45`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthCreateDialog.svelte",
    "line": 45,
    "tag": "<Dialog.Content",
    "classValue": "\"!max-w-4xl sm:!max-w-4xl\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthCreateDialog.svelte:59`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthCreateDialog.svelte",
    "line": 59,
    "tag": "<ScrollArea",
    "classValue": "\"h-[min(64vh,40rem)]\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthCreateFields.svelte:12`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthCreateFields.svelte",
    "line": 12,
    "tag": "<Field.Group",
    "classValue": "\"content-start gap-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthCreateFields.svelte:32`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthCreateFields.svelte",
    "line": 32,
    "tag": "<Textarea",
    "classValue": "\"min-h-32\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthCredentialField.svelte:15`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthCredentialField.svelte",
    "line": 15,
    "tag": "<Item.Content",
    "classValue": "\"min-w-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthCredentialField.svelte:17`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthCredentialField.svelte",
    "line": 17,
    "tag": "<Item.Description",
    "classValue": "\"break-all\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthCredentialMetadata.svelte:14`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthCredentialMetadata.svelte",
    "line": 14,
    "tag": "<Item.Group",
    "classValue": "\"gap-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthCredentialMetadata.svelte:41`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthCredentialMetadata.svelte",
    "line": 41,
    "tag": "<Item.Content",
    "classValue": "\"min-w-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthCredentialsDialog.svelte:31`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthCredentialsDialog.svelte",
    "line": 31,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-2xl sm:max-w-2xl\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthDeleteDialog.svelte:26`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthDeleteDialog.svelte",
    "line": 26,
    "tag": "<AlertDialog.Content",
    "classValue": "\"max-w-md sm:max-w-md\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthHeader.svelte:21`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthHeader.svelte",
    "line": 21,
    "tag": "<Button",
    "classValue": "\"w-full sm:w-auto\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthScopePicker.svelte:21`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthScopePicker.svelte",
    "line": 21,
    "tag": "<Field.Legend",
    "classValue": "\"mb-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthScopePicker.svelte:29`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthScopePicker.svelte",
    "line": 29,
    "tag": "<Field.Group",
    "classValue": "\"gap-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminOAuthScopePicker.svelte:39`  
  ```json
  {
    "file": "src/features/admin/components/AdminOAuthScopePicker.svelte",
    "line": 39,
    "tag": "<Field.Label",
    "classValue": "\"cursor-pointer\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUserDialog.svelte:47`  
  ```json
  {
    "file": "src/features/admin/components/AdminUserDialog.svelte",
    "line": 47,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-2xl sm:max-w-2xl\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUserDialog.svelte:53`  
  ```json
  {
    "file": "src/features/admin/components/AdminUserDialog.svelte",
    "line": 53,
    "tag": "<ScrollArea",
    "classValue": "\"h-[min(62vh,34rem)]\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUserDialogHeader.svelte:16`  
  ```json
  {
    "file": "src/features/admin/components/AdminUserDialogHeader.svelte",
    "line": 16,
    "tag": "<Dialog.Description",
    "classValue": "\"break-all\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUserProfileSection.svelte:14`  
  ```json
  {
    "file": "src/features/admin/components/AdminUserProfileSection.svelte",
    "line": 14,
    "tag": "<Field.Set",
    "classValue": "\"bg-subtle p-3\"",
    "styleValue": null,
    "decision": "convert",
    "action": "keep layout tokens (p-3); convert styling tokens: bg-subtle",
    "reason": "mixes layout and styling tokens"
  }
  ```

- `src/features/admin/components/AdminUserProfileSection.svelte:17`  
  ```json
  {
    "file": "src/features/admin/components/AdminUserProfileSection.svelte",
    "line": 17,
    "tag": "<Field.Group",
    "classValue": "\"grid gap-3 sm:grid-cols-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUserProfileSection.svelte:39`  
  ```json
  {
    "file": "src/features/admin/components/AdminUserProfileSection.svelte",
    "line": 39,
    "tag": "<Field.Field",
    "classValue": "\"w-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUserSuspensionSection.svelte:33`  
  ```json
  {
    "file": "src/features/admin/components/AdminUserSuspensionSection.svelte",
    "line": 33,
    "tag": "<Field.Set",
    "classValue": "\"bg-subtle p-3\"",
    "styleValue": null,
    "decision": "convert",
    "action": "keep layout tokens (p-3); convert styling tokens: bg-subtle",
    "reason": "mixes layout and styling tokens"
  }
  ```

- `src/features/admin/components/AdminUserSuspensionSection.svelte:34`  
  ```json
  {
    "file": "src/features/admin/components/AdminUserSuspensionSection.svelte",
    "line": 34,
    "tag": "<Field.Legend",
    "classValue": "\"flex flex-wrap items-center gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUserSuspensionSection.svelte:44`  
  ```json
  {
    "file": "src/features/admin/components/AdminUserSuspensionSection.svelte",
    "line": 44,
    "tag": "<Field.Group",
    "classValue": "\"grid gap-4 sm:grid-cols-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUserSuspensionSection.svelte:49`  
  ```json
  {
    "file": "src/features/admin/components/AdminUserSuspensionSection.svelte",
    "line": 49,
    "tag": "<NativeSelect.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUsersDesktopTable.svelte:29`  
  ```json
  {
    "file": "src/features/admin/components/AdminUsersDesktopTable.svelte",
    "line": 29,
    "tag": "<Table.Head",
    "classValue": "\"w-24 text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUsersDesktopTable.svelte:49`  
  ```json
  {
    "file": "src/features/admin/components/AdminUsersDesktopTable.svelte",
    "line": 49,
    "tag": "<Badge",
    "classValue": "\"w-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUsersDesktopTable.svelte:57`  
  ```json
  {
    "file": "src/features/admin/components/AdminUsersDesktopTable.svelte",
    "line": 57,
    "tag": "<Table.Cell",
    "classValue": "\"text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUsersMobileList.svelte:18`  
  ```json
  {
    "file": "src/features/admin/components/AdminUsersMobileList.svelte",
    "line": 18,
    "tag": "<Item.Group",
    "classValue": "\"md:hidden\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUsersMobileList.svelte:20`  
  ```json
  {
    "file": "src/features/admin/components/AdminUsersMobileList.svelte",
    "line": 20,
    "tag": "<Item.Root",
    "classValue": "{`items-start border-l-4 text-left ${user.activeSuspension ? \"border-l-warning\" : user.isAdmin ? \"border-l-success\" : \"border-l-primary\"}`}",
    "styleValue": null,
    "decision": "convert",
    "action": "keep layout tokens (items-start, text-left); convert styling tokens: border-l-warning, border-l-success, border-l-primary, border-l-4",
    "reason": "mixes layout and styling tokens"
  }
  ```

- `src/features/admin/components/AdminUsersMobileList.svelte:27`  
  ```json
  {
    "file": "src/features/admin/components/AdminUsersMobileList.svelte",
    "line": 27,
    "tag": "<Item.Content",
    "classValue": "\"min-w-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUsersMobileList.svelte:32`  
  ```json
  {
    "file": "src/features/admin/components/AdminUsersMobileList.svelte",
    "line": 32,
    "tag": "<Item.Description",
    "classValue": "\"line-clamp-none break-words\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUsersMobileList.svelte:41`  
  ```json
  {
    "file": "src/features/admin/components/AdminUsersMobileList.svelte",
    "line": 41,
    "tag": "<Item.Footer",
    "classValue": "\"block\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUsersSearchCard.svelte:25`  
  ```json
  {
    "file": "src/features/admin/components/AdminUsersSearchCard.svelte",
    "line": 25,
    "tag": "<Field.Label",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUsersSearchCard.svelte:26`  
  ```json
  {
    "file": "src/features/admin/components/AdminUsersSearchCard.svelte",
    "line": 26,
    "tag": "<ButtonGroup.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUsersSearchCard.svelte:27`  
  ```json
  {
    "file": "src/features/admin/components/AdminUsersSearchCard.svelte",
    "line": 27,
    "tag": "<InputGroup.Root",
    "classValue": "\"min-w-0 flex-1\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUsersTableCard.svelte:47`  
  ```json
  {
    "file": "src/features/admin/components/AdminUsersTableCard.svelte",
    "line": 47,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/AdminUsersTableCard.svelte:49`  
  ```json
  {
    "file": "src/features/admin/components/AdminUsersTableCard.svelte",
    "line": 49,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-24\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/admin/components/ModerationStatusBadge.svelte:9`  
  ```json
  {
    "file": "src/features/admin/components/ModerationStatusBadge.svelte",
    "line": 9,
    "tag": "<Badge",
    "classValue": "{status === \"active\"\n    ? \"border-success/40 bg-success/10 text-success\"\n    : status === \"deleted\"\n      ? \"border-destructive/40 bg-destructive/10 text-destructive\"\n      : \"border-warning/40 bg-warning/10 text-warning\"}",
    "styleValue": null,
    "decision": "review",
    "action": "inspect dynamic expression; convert styling tokens to variants or theme tokens",
    "reason": "dynamic class expression may contain styling overrides: border-success/40, bg-success/10, border-destructive/40, bg-destructive/10, text-destructive, border-warning/40, bg-warning/10, text-success, text-warning"
  }
  ```

- `src/features/api-docs/components/ApiDocsPage.svelte:147`  
  ```json
  {
    "file": "src/features/api-docs/components/ApiDocsPage.svelte",
    "line": 147,
    "tag": "<Button",
    "classValue": "\"w-full sm:w-auto\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/auth/components/SignInPage.svelte:81`  
  ```json
  {
    "file": "src/features/auth/components/SignInPage.svelte",
    "line": 81,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/auth/components/SignInPage.svelte:100`  
  ```json
  {
    "file": "src/features/auth/components/SignInPage.svelte",
    "line": 100,
    "tag": "<Button",
    "classValue": "\"h-auto w-full justify-start p-3 text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapActiveTripList.svelte:43`  
  ```json
  {
    "file": "src/features/bus/components/BusMapActiveTripList.svelte",
    "line": 43,
    "tag": "<ScrollArea",
    "classValue": "\"h-72\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapActiveTripList.svelte:80`  
  ```json
  {
    "file": "src/features/bus/components/BusMapActiveTripList.svelte",
    "line": 80,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-20 p-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapContent.svelte:47`  
  ```json
  {
    "file": "src/features/bus/components/BusMapContent.svelte",
    "line": 47,
    "tag": "<Empty.Root",
    "classValue": "\"py-16\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapContent.svelte:55`  
  ```json
  {
    "file": "src/features/bus/components/BusMapContent.svelte",
    "line": 55,
    "tag": "<Card.Root",
    "classValue": "\"overflow-hidden\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapContent.svelte:60`  
  ```json
  {
    "file": "src/features/bus/components/BusMapContent.svelte",
    "line": 60,
    "tag": "<Card.Content",
    "classValue": "\"p-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapContent.svelte:61`  
  ```json
  {
    "file": "src/features/bus/components/BusMapContent.svelte",
    "line": 61,
    "tag": "<ScrollArea",
    "classValue": "\"p-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapLegendPanel.svelte:30`  
  ```json
  {
    "file": "src/features/bus/components/BusMapLegendPanel.svelte",
    "line": 30,
    "tag": "<ScrollArea",
    "classValue": "\"h-[min(70vh,32rem)]\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapLegendPanel.svelte:31`  
  ```json
  {
    "file": "src/features/bus/components/BusMapLegendPanel.svelte",
    "line": 31,
    "tag": "<Item.Group",
    "classValue": "\"gap-1.5\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapLegendPanel.svelte:33`  
  ```json
  {
    "file": "src/features/bus/components/BusMapLegendPanel.svelte",
    "line": 33,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapLegendPanel.svelte:49`  
  ```json
  {
    "file": "src/features/bus/components/BusMapLegendPanel.svelte",
    "line": 49,
    "tag": "<Item.Description",
    "classValue": "\"line-clamp-none\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapPageHeader.svelte:21`  
  ```json
  {
    "file": "src/features/bus/components/BusMapPageHeader.svelte",
    "line": 21,
    "tag": "<Button",
    "classValue": "\"w-fit p-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapPageHeader.svelte:24`  
  ```json
  {
    "file": "src/features/bus/components/BusMapPageHeader.svelte",
    "line": 24,
    "tag": "<Badge",
    "classValue": "\"ml-3 align-middle\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapPageHeader.svelte:39`  
  ```json
  {
    "file": "src/features/bus/components/BusMapPageHeader.svelte",
    "line": 39,
    "tag": "<Item.Group",
    "classValue": "\"grid gap-3 sm:grid-cols-2 lg:grid-cols-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapPageHeader.svelte:40`  
  ```json
  {
    "file": "src/features/bus/components/BusMapPageHeader.svelte",
    "line": 40,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapPageHeader.svelte:46`  
  ```json
  {
    "file": "src/features/bus/components/BusMapPageHeader.svelte",
    "line": 46,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapPageHeader.svelte:52`  
  ```json
  {
    "file": "src/features/bus/components/BusMapPageHeader.svelte",
    "line": 52,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapPageHeader.svelte:58`  
  ```json
  {
    "file": "src/features/bus/components/BusMapPageHeader.svelte",
    "line": 58,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapStatusPanel.svelte:26`  
  ```json
  {
    "file": "src/features/bus/components/BusMapStatusPanel.svelte",
    "line": 26,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapStatusPanel.svelte:27`  
  ```json
  {
    "file": "src/features/bus/components/BusMapStatusPanel.svelte",
    "line": 27,
    "tag": "<Item.Group",
    "classValue": "\"grid grid-cols-2 gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapStatusPanel.svelte:28`  
  ```json
  {
    "file": "src/features/bus/components/BusMapStatusPanel.svelte",
    "line": 28,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/bus/components/BusMapStatusPanel.svelte:34`  
  ```json
  {
    "file": "src/features/bus/components/BusMapStatusPanel.svelte",
    "line": 34,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CatalogFilterSidebar.svelte:13`  
  ```json
  {
    "file": "src/features/catalog/components/CatalogFilterSidebar.svelte",
    "line": 13,
    "tag": "<Sidebar.Root",
    "classValue": "\"w-full border-b border-sidebar-border lg:sticky lg:top-0 lg:h-[calc(100svh-3rem)] lg:w-(--sidebar-width) lg:border-e lg:border-b-0\"",
    "styleValue": null,
    "decision": "convert",
    "action": "keep layout tokens (w-full, sticky, top-0, h-[calc(100svh-3rem)], w-(--sidebar-width)); convert styling tokens: border-b, border-sidebar-border, border-e, border-b-0",
    "reason": "mixes layout and styling tokens"
  }
  ```

- `src/features/catalog/components/CatalogFilterSidebar.svelte:18`  
  ```json
  {
    "file": "src/features/catalog/components/CatalogFilterSidebar.svelte",
    "line": 18,
    "tag": "<Sidebar.Header",
    "classValue": "\"p-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CatalogFilterSidebar.svelte:37`  
  ```json
  {
    "file": "src/features/catalog/components/CatalogFilterSidebar.svelte",
    "line": 37,
    "tag": "<Badge",
    "classValue": "\"shrink-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CatalogResultsEmpty.svelte:9`  
  ```json
  {
    "file": "src/features/catalog/components/CatalogResultsEmpty.svelte",
    "line": 9,
    "tag": "<Empty.Root",
    "classValue": "{centered ? \"\" : \"items-start text-left\"}",
    "styleValue": null,
    "decision": "keep",
    "action": "no class tokens to remediate",
    "reason": "empty or expression-only class value with no static styling tokens"
  }
  ```

- `src/features/catalog/components/CatalogResultsEmpty.svelte:10`  
  ```json
  {
    "file": "src/features/catalog/components/CatalogResultsEmpty.svelte",
    "line": 10,
    "tag": "<Empty.Header",
    "classValue": "{centered ? \"\" : \"items-start text-left\"}",
    "styleValue": null,
    "decision": "keep",
    "action": "no class tokens to remediate",
    "reason": "empty or expression-only class value with no static styling tokens"
  }
  ```

- `src/features/catalog/components/CourseDetailPageController.svelte:158`  
  ```json
  {
    "file": "src/features/catalog/components/CourseDetailPageController.svelte",
    "line": 158,
    "tag": "<ScrollArea",
    "classValue": "\"min-w-0 min-h-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CourseDetailSectionsMobile.svelte:18`  
  ```json
  {
    "file": "src/features/catalog/components/CourseDetailSectionsMobile.svelte",
    "line": 18,
    "tag": "<Item.Group",
    "classValue": "\"md:hidden\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CourseDetailSectionsMobile.svelte:32`  
  ```json
  {
    "file": "src/features/catalog/components/CourseDetailSectionsMobile.svelte",
    "line": 32,
    "tag": "<Item.Footer",
    "classValue": "\"flex-wrap justify-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CourseDetailSectionsTable.svelte:23`  
  ```json
  {
    "file": "src/features/catalog/components/CourseDetailSectionsTable.svelte",
    "line": 23,
    "tag": "<Table.Head",
    "classValue": "\"w-32\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CourseDetailSectionsTable.svelte:24`  
  ```json
  {
    "file": "src/features/catalog/components/CourseDetailSectionsTable.svelte",
    "line": 24,
    "tag": "<Table.Head",
    "classValue": "\"w-28\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CourseDetailSectionsTable.svelte:26`  
  ```json
  {
    "file": "src/features/catalog/components/CourseDetailSectionsTable.svelte",
    "line": 26,
    "tag": "<Table.Head",
    "classValue": "\"w-20 text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CourseDetailSectionsTable.svelte:27`  
  ```json
  {
    "file": "src/features/catalog/components/CourseDetailSectionsTable.svelte",
    "line": 27,
    "tag": "<Table.Head",
    "classValue": "\"w-24 text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CourseDetailSectionsTable.svelte:34`  
  ```json
  {
    "file": "src/features/catalog/components/CourseDetailSectionsTable.svelte",
    "line": 34,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CourseDetailSectionsTable.svelte:39`  
  ```json
  {
    "file": "src/features/catalog/components/CourseDetailSectionsTable.svelte",
    "line": 39,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CourseDetailSectionsTable.svelte:44`  
  ```json
  {
    "file": "src/features/catalog/components/CourseDetailSectionsTable.svelte",
    "line": 44,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CourseDetailSectionsTable.svelte:49`  
  ```json
  {
    "file": "src/features/catalog/components/CourseDetailSectionsTable.svelte",
    "line": 49,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 text-right align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CourseDetailSectionsTable.svelte:54`  
  ```json
  {
    "file": "src/features/catalog/components/CourseDetailSectionsTable.svelte",
    "line": 54,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 text-right align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CourseDetailSectionsTable.svelte:62`  
  ```json
  {
    "file": "src/features/catalog/components/CourseDetailSectionsTable.svelte",
    "line": 62,
    "tag": "<Table.Cell",
    "classValue": "\"p-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CourseDetailSectionsTable.svelte:63`  
  ```json
  {
    "file": "src/features/catalog/components/CourseDetailSectionsTable.svelte",
    "line": 63,
    "tag": "<Empty.Root",
    "classValue": "\"py-6\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesFilters.svelte:27`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesFilters.svelte",
    "line": 27,
    "tag": "<Field.Group",
    "classValue": "\"gap-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesFilters.svelte:43`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesFilters.svelte",
    "line": 43,
    "tag": "<NativeSelect.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesFilters.svelte:62`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesFilters.svelte",
    "line": 62,
    "tag": "<NativeSelect.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesFilters.svelte:81`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesFilters.svelte",
    "line": 81,
    "tag": "<NativeSelect.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesFilters.svelte:98`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesFilters.svelte",
    "line": 98,
    "tag": "<ButtonGroup.Root",
    "classValue": "\"w-full pt-1\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesFilters.svelte:99`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesFilters.svelte",
    "line": 99,
    "tag": "<Button",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesFilters.svelte:103`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesFilters.svelte",
    "line": 103,
    "tag": "<Button",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesResults.svelte:62`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesResults.svelte",
    "line": 62,
    "tag": "<Item.Footer",
    "classValue": "\"flex-wrap justify-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesResults.svelte:77`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesResults.svelte",
    "line": 77,
    "tag": "<Table.Head",
    "classValue": "\"min-w-72\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesResults.svelte:78`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesResults.svelte",
    "line": 78,
    "tag": "<Table.Head",
    "classValue": "\"w-28\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesResults.svelte:79`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesResults.svelte",
    "line": 79,
    "tag": "<Table.Head",
    "classValue": "\"w-36\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesResults.svelte:80`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesResults.svelte",
    "line": 80,
    "tag": "<Table.Head",
    "classValue": "\"w-40\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesResults.svelte:81`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesResults.svelte",
    "line": 81,
    "tag": "<Table.Head",
    "classValue": "\"w-36\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesResults.svelte:88`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesResults.svelte",
    "line": 88,
    "tag": "<Table.Cell",
    "classValue": "\"min-w-72 p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesResults.svelte:96`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesResults.svelte",
    "line": 96,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesResults.svelte:101`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesResults.svelte",
    "line": 101,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesResults.svelte:106`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesResults.svelte",
    "line": 106,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/CoursesResults.svelte:111`  
  ```json
  {
    "file": "src/features/catalog/components/CoursesResults.svelte",
    "line": 111,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionSearchHelpDialog.svelte:25`  
  ```json
  {
    "file": "src/features/catalog/components/SectionSearchHelpDialog.svelte",
    "line": 25,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-2xl sm:max-w-2xl\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionSearchHelpDialog.svelte:33`  
  ```json
  {
    "file": "src/features/catalog/components/SectionSearchHelpDialog.svelte",
    "line": 33,
    "tag": "<ScrollArea",
    "classValue": "\"h-[min(60vh,24rem)]\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionSearchHelpDialog.svelte:34`  
  ```json
  {
    "file": "src/features/catalog/components/SectionSearchHelpDialog.svelte",
    "line": 34,
    "tag": "<Item.Group",
    "classValue": "\"px-5 py-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionSearchHelpDialog.svelte:36`  
  ```json
  {
    "file": "src/features/catalog/components/SectionSearchHelpDialog.svelte",
    "line": 36,
    "tag": "<Item.Root",
    "classValue": "\"items-start sm:flex-nowrap\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionSearchHelpDialog.svelte:40`  
  ```json
  {
    "file": "src/features/catalog/components/SectionSearchHelpDialog.svelte",
    "line": 40,
    "tag": "<Item.Content",
    "classValue": "\"min-w-0 sm:max-w-48 sm:flex-none\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionSearchHelpDialog.svelte:46`  
  ```json
  {
    "file": "src/features/catalog/components/SectionSearchHelpDialog.svelte",
    "line": 46,
    "tag": "<Item.Content",
    "classValue": "\"min-w-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionSearchHelpDialog.svelte:47`  
  ```json
  {
    "file": "src/features/catalog/components/SectionSearchHelpDialog.svelte",
    "line": 47,
    "tag": "<Item.Description",
    "classValue": "\"line-clamp-none\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsFilters.svelte:27`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsFilters.svelte",
    "line": 27,
    "tag": "<Field.Group",
    "classValue": "\"gap-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsFilters.svelte:43`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsFilters.svelte",
    "line": 43,
    "tag": "<NativeSelect.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsFilters.svelte:60`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsFilters.svelte",
    "line": 60,
    "tag": "<ButtonGroup.Root",
    "classValue": "\"w-full pt-1\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsFilters.svelte:61`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsFilters.svelte",
    "line": 61,
    "tag": "<Button",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsFilters.svelte:62`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsFilters.svelte",
    "line": 62,
    "tag": "<Button",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsFilters.svelte:74`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsFilters.svelte",
    "line": 74,
    "tag": "<Button",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsResults.svelte:74`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsResults.svelte",
    "line": 74,
    "tag": "<Item.Footer",
    "classValue": "\"flex-wrap justify-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsResults.svelte:89`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsResults.svelte",
    "line": 89,
    "tag": "<Table.Head",
    "classValue": "\"w-36\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsResults.svelte:90`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsResults.svelte",
    "line": 90,
    "tag": "<Table.Head",
    "classValue": "\"min-w-72\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsResults.svelte:91`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsResults.svelte",
    "line": 91,
    "tag": "<Table.Head",
    "classValue": "\"w-28\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsResults.svelte:92`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsResults.svelte",
    "line": 92,
    "tag": "<Table.Head",
    "classValue": "\"min-w-44\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsResults.svelte:93`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsResults.svelte",
    "line": 93,
    "tag": "<Table.Head",
    "classValue": "\"w-20 text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsResults.svelte:94`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsResults.svelte",
    "line": 94,
    "tag": "<Table.Head",
    "classValue": "\"w-28 text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsResults.svelte:95`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsResults.svelte",
    "line": 95,
    "tag": "<Table.Head",
    "classValue": "\"w-28 text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsResults.svelte:102`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsResults.svelte",
    "line": 102,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsResults.svelte:107`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsResults.svelte",
    "line": 107,
    "tag": "<Table.Cell",
    "classValue": "\"min-w-72 p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsResults.svelte:115`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsResults.svelte",
    "line": 115,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsResults.svelte:120`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsResults.svelte",
    "line": 120,
    "tag": "<Table.Cell",
    "classValue": "\"min-w-44 p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsResults.svelte:125`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsResults.svelte",
    "line": 125,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 text-right align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsResults.svelte:130`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsResults.svelte",
    "line": 130,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 text-right align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/SectionsResults.svelte:135`  
  ```json
  {
    "file": "src/features/catalog/components/SectionsResults.svelte",
    "line": 135,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 text-right align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeacherDetailBasicInfo.svelte:37`  
  ```json
  {
    "file": "src/features/catalog/components/TeacherDetailBasicInfo.svelte",
    "line": 37,
    "tag": "<Button",
    "classValue": "\"h-auto justify-start whitespace-normal break-all p-0 text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeacherDetailPageController.svelte:153`  
  ```json
  {
    "file": "src/features/catalog/components/TeacherDetailPageController.svelte",
    "line": 153,
    "tag": "<ScrollArea",
    "classValue": "\"min-w-0 min-h-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeacherDetailSectionsMobile.svelte:18`  
  ```json
  {
    "file": "src/features/catalog/components/TeacherDetailSectionsMobile.svelte",
    "line": 18,
    "tag": "<Item.Group",
    "classValue": "\"md:hidden\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeacherDetailSectionsMobile.svelte:32`  
  ```json
  {
    "file": "src/features/catalog/components/TeacherDetailSectionsMobile.svelte",
    "line": 32,
    "tag": "<Item.Footer",
    "classValue": "\"flex-wrap justify-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeacherDetailSectionsTable.svelte:23`  
  ```json
  {
    "file": "src/features/catalog/components/TeacherDetailSectionsTable.svelte",
    "line": 23,
    "tag": "<Table.Head",
    "classValue": "\"w-32\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeacherDetailSectionsTable.svelte:25`  
  ```json
  {
    "file": "src/features/catalog/components/TeacherDetailSectionsTable.svelte",
    "line": 25,
    "tag": "<Table.Head",
    "classValue": "\"w-28\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeacherDetailSectionsTable.svelte:26`  
  ```json
  {
    "file": "src/features/catalog/components/TeacherDetailSectionsTable.svelte",
    "line": 26,
    "tag": "<Table.Head",
    "classValue": "\"w-16 text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeacherDetailSectionsTable.svelte:33`  
  ```json
  {
    "file": "src/features/catalog/components/TeacherDetailSectionsTable.svelte",
    "line": 33,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeacherDetailSectionsTable.svelte:38`  
  ```json
  {
    "file": "src/features/catalog/components/TeacherDetailSectionsTable.svelte",
    "line": 38,
    "tag": "<Table.Cell",
    "classValue": "\"min-w-72 p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeacherDetailSectionsTable.svelte:44`  
  ```json
  {
    "file": "src/features/catalog/components/TeacherDetailSectionsTable.svelte",
    "line": 44,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeacherDetailSectionsTable.svelte:49`  
  ```json
  {
    "file": "src/features/catalog/components/TeacherDetailSectionsTable.svelte",
    "line": 49,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 text-right align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeacherDetailSectionsTable.svelte:57`  
  ```json
  {
    "file": "src/features/catalog/components/TeacherDetailSectionsTable.svelte",
    "line": 57,
    "tag": "<Table.Cell",
    "classValue": "\"p-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeacherDetailSectionsTable.svelte:58`  
  ```json
  {
    "file": "src/features/catalog/components/TeacherDetailSectionsTable.svelte",
    "line": 58,
    "tag": "<Empty.Root",
    "classValue": "\"py-6\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersFilters.svelte:25`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersFilters.svelte",
    "line": 25,
    "tag": "<Field.Group",
    "classValue": "\"gap-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersFilters.svelte:41`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersFilters.svelte",
    "line": 41,
    "tag": "<NativeSelect.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersFilters.svelte:58`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersFilters.svelte",
    "line": 58,
    "tag": "<ButtonGroup.Root",
    "classValue": "\"w-full pt-1\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersFilters.svelte:59`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersFilters.svelte",
    "line": 59,
    "tag": "<Button",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersFilters.svelte:61`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersFilters.svelte",
    "line": 61,
    "tag": "<Button",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersResults.svelte:79`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersResults.svelte",
    "line": 79,
    "tag": "<Item.Footer",
    "classValue": "\"flex-wrap justify-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersResults.svelte:97`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersResults.svelte",
    "line": 97,
    "tag": "<Table.Head",
    "classValue": "\"min-w-56\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersResults.svelte:98`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersResults.svelte",
    "line": 98,
    "tag": "<Table.Head",
    "classValue": "\"w-28\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersResults.svelte:99`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersResults.svelte",
    "line": 99,
    "tag": "<Table.Head",
    "classValue": "\"min-w-44\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersResults.svelte:100`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersResults.svelte",
    "line": 100,
    "tag": "<Table.Head",
    "classValue": "\"w-36\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersResults.svelte:101`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersResults.svelte",
    "line": 101,
    "tag": "<Table.Head",
    "classValue": "\"min-w-56\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersResults.svelte:102`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersResults.svelte",
    "line": 102,
    "tag": "<Table.Head",
    "classValue": "\"w-24 text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersResults.svelte:109`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersResults.svelte",
    "line": 109,
    "tag": "<Table.Cell",
    "classValue": "\"min-w-56 p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersResults.svelte:117`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersResults.svelte",
    "line": 117,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersResults.svelte:126`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersResults.svelte",
    "line": 126,
    "tag": "<Table.Cell",
    "classValue": "\"min-w-44 p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersResults.svelte:131`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersResults.svelte",
    "line": 131,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersResults.svelte:136`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersResults.svelte",
    "line": 136,
    "tag": "<Table.Cell",
    "classValue": "\"min-w-56 p-0 align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/catalog/components/TeachersResults.svelte:141`  
  ```json
  {
    "file": "src/features/catalog/components/TeachersResults.svelte",
    "line": 141,
    "tag": "<Table.Cell",
    "classValue": "\"p-0 text-right align-top\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentAttachmentCards.svelte:17`  
  ```json
  {
    "file": "src/features/comments/components/CommentAttachmentCards.svelte",
    "line": 17,
    "tag": "<Item.Group",
    "classValue": "\"grid gap-2 sm:grid-cols-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentAttachmentCards.svelte:19`  
  ```json
  {
    "file": "src/features/comments/components/CommentAttachmentCards.svelte",
    "line": 19,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentAttachmentCards.svelte:20`  
  ```json
  {
    "file": "src/features/comments/components/CommentAttachmentCards.svelte",
    "line": 20,
    "tag": "<Item.Content",
    "classValue": "\"min-w-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentAttachmentCards.svelte:25`  
  ```json
  {
    "file": "src/features/comments/components/CommentAttachmentCards.svelte",
    "line": 25,
    "tag": "<Button",
    "classValue": "\"w-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentAttachmentPills.svelte:20`  
  ```json
  {
    "file": "src/features/comments/components/CommentAttachmentPills.svelte",
    "line": 20,
    "tag": "<Badge",
    "classValue": "\"gap-1 pr-1\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentComposer.svelte:85`  
  ```json
  {
    "file": "src/features/comments/components/CommentComposer.svelte",
    "line": 85,
    "tag": "<Field.Title",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentComposerActions.svelte:40`  
  ```json
  {
    "file": "src/features/comments/components/CommentComposerActions.svelte",
    "line": 40,
    "tag": "<Button",
    "classValue": "\"ml-auto\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentComposerHeader.svelte:26`  
  ```json
  {
    "file": "src/features/comments/components/CommentComposerHeader.svelte",
    "line": 26,
    "tag": "<Field.Group",
    "classValue": "\"flex-row flex-wrap items-center gap-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentComposerHeader.svelte:27`  
  ```json
  {
    "file": "src/features/comments/components/CommentComposerHeader.svelte",
    "line": 27,
    "tag": "<Field.Field",
    "classValue": "\"w-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentComposerHeader.svelte:41`  
  ```json
  {
    "file": "src/features/comments/components/CommentComposerHeader.svelte",
    "line": 41,
    "tag": "<Field.Field",
    "classValue": "\"w-auto\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentComposerHeader.svelte:42`  
  ```json
  {
    "file": "src/features/comments/components/CommentComposerHeader.svelte",
    "line": 42,
    "tag": "<Field.Label",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentComposerHeader.svelte:45`  
  ```json
  {
    "file": "src/features/comments/components/CommentComposerHeader.svelte",
    "line": 45,
    "tag": "<NativeSelect.Root",
    "classValue": "\"min-w-32\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentComposerTargetSelect.svelte:17`  
  ```json
  {
    "file": "src/features/comments/components/CommentComposerTargetSelect.svelte",
    "line": 17,
    "tag": "<Field.Field",
    "classValue": "\"max-w-sm\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentComposerTargetSelect.svelte:21`  
  ```json
  {
    "file": "src/features/comments/components/CommentComposerTargetSelect.svelte",
    "line": 21,
    "tag": "<NativeSelect.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentDeleteDialog.svelte:19`  
  ```json
  {
    "file": "src/features/comments/components/CommentDeleteDialog.svelte",
    "line": 19,
    "tag": "<AlertDialog.Content",
    "classValue": "\"max-w-md sm:max-w-md\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentLinkCards.svelte:83`  
  ```json
  {
    "file": "src/features/comments/components/CommentLinkCards.svelte",
    "line": 83,
    "tag": "<Item.Group",
    "classValue": "\"mt-3 grid gap-2 sm:grid-cols-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentReactionControls.svelte:59`  
  ```json
  {
    "file": "src/features/comments/components/CommentReactionControls.svelte",
    "line": 59,
    "tag": "<DropdownMenu.Content",
    "classValue": "\"w-56\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentReactionControls.svelte:62`  
  ```json
  {
    "file": "src/features/comments/components/CommentReactionControls.svelte",
    "line": 62,
    "tag": "<DropdownMenu.CheckboxItem",
    "classValue": "{cn(\n                pendingReactionKey && \"opacity-70\",\n              )}",
    "styleValue": null,
    "decision": "review",
    "action": "inspect dynamic expression; convert styling tokens to variants or theme tokens",
    "reason": "dynamic class expression may contain styling overrides: opacity-70"
  }
  ```

- `src/features/comments/components/CommentReplyEditor.svelte:51`  
  ```json
  {
    "file": "src/features/comments/components/CommentReplyEditor.svelte",
    "line": 51,
    "tag": "<Field.Group",
    "classValue": "\"gap-3 p-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentReplyEditor.svelte:53`  
  ```json
  {
    "file": "src/features/comments/components/CommentReplyEditor.svelte",
    "line": 53,
    "tag": "<Field.Title",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentReplyEditor.svelte:77`  
  ```json
  {
    "file": "src/features/comments/components/CommentReplyEditor.svelte",
    "line": 77,
    "tag": "<Field.Group",
    "classValue": "\"flex-row flex-wrap items-center gap-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentReplyEditor.svelte:78`  
  ```json
  {
    "file": "src/features/comments/components/CommentReplyEditor.svelte",
    "line": 78,
    "tag": "<Field.Field",
    "classValue": "\"w-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentReplyEditor.svelte:92`  
  ```json
  {
    "file": "src/features/comments/components/CommentReplyEditor.svelte",
    "line": 92,
    "tag": "<Field.Field",
    "classValue": "\"w-auto\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentReplyEditor.svelte:93`  
  ```json
  {
    "file": "src/features/comments/components/CommentReplyEditor.svelte",
    "line": 93,
    "tag": "<Field.Label",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentReplyEditor.svelte:96`  
  ```json
  {
    "file": "src/features/comments/components/CommentReplyEditor.svelte",
    "line": 96,
    "tag": "<NativeSelect.Root",
    "classValue": "\"min-w-32\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentThreadEditForm.svelte:39`  
  ```json
  {
    "file": "src/features/comments/components/CommentThreadEditForm.svelte",
    "line": 39,
    "tag": "<Field.Group",
    "classValue": "\"gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentThreadEditForm.svelte:41`  
  ```json
  {
    "file": "src/features/comments/components/CommentThreadEditForm.svelte",
    "line": 41,
    "tag": "<Field.Group",
    "classValue": "\"flex-row flex-wrap items-center justify-between gap-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentThreadEditForm.svelte:42`  
  ```json
  {
    "file": "src/features/comments/components/CommentThreadEditForm.svelte",
    "line": 42,
    "tag": "<Field.Field",
    "classValue": "\"w-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentThreadEditForm.svelte:48`  
  ```json
  {
    "file": "src/features/comments/components/CommentThreadEditForm.svelte",
    "line": 48,
    "tag": "<Field.Field",
    "classValue": "\"w-auto\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentThreadEditForm.svelte:49`  
  ```json
  {
    "file": "src/features/comments/components/CommentThreadEditForm.svelte",
    "line": 49,
    "tag": "<Field.Label",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentThreadEditForm.svelte:52`  
  ```json
  {
    "file": "src/features/comments/components/CommentThreadEditForm.svelte",
    "line": 52,
    "tag": "<NativeSelect.Root",
    "classValue": "\"min-w-32\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentThreadEditForm.svelte:67`  
  ```json
  {
    "file": "src/features/comments/components/CommentThreadEditForm.svelte",
    "line": 67,
    "tag": "<Field.Title",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentThreadItem.svelte:84`  
  ```json
  {
    "file": "src/features/comments/components/CommentThreadItem.svelte",
    "line": 84,
    "tag": "<Card.Root",
    "classValue": "{highlightedId === comment.id ? \"ring-2 ring-primary/40\" : \"\"}",
    "styleValue": null,
    "decision": "review",
    "action": "inspect dynamic expression; convert styling tokens to variants or theme tokens",
    "reason": "dynamic class expression may contain styling overrides: ring-2, ring-primary/40"
  }
  ```

- `src/features/comments/components/CommentThreadItem.svelte:87`  
  ```json
  {
    "file": "src/features/comments/components/CommentThreadItem.svelte",
    "line": 87,
    "tag": "<Card.Header",
    "classValue": "\"px-4 md:px-5\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentThreadItem.svelte:103`  
  ```json
  {
    "file": "src/features/comments/components/CommentThreadItem.svelte",
    "line": 103,
    "tag": "<Card.Content",
    "classValue": "\"px-4 md:px-5\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentThreadItem.svelte:123`  
  ```json
  {
    "file": "src/features/comments/components/CommentThreadItem.svelte",
    "line": 123,
    "tag": "<Card.Footer",
    "classValue": "\"flex-col items-stretch gap-4 px-4 md:px-5\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentUploadButton.svelte:27`  
  ```json
  {
    "file": "src/features/comments/components/CommentUploadButton.svelte",
    "line": 27,
    "tag": "<Input",
    "classValue": "\"sr-only h-px w-px p-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentsPanelLoadingComposer.svelte:9`  
  ```json
  {
    "file": "src/features/comments/components/CommentsPanelLoadingComposer.svelte",
    "line": 9,
    "tag": "<Skeleton",
    "classValue": "\"h-5 w-32\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentsPanelLoadingComposer.svelte:10`  
  ```json
  {
    "file": "src/features/comments/components/CommentsPanelLoadingComposer.svelte",
    "line": 10,
    "tag": "<Skeleton",
    "classValue": "\"h-4 w-56 max-w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentsPanelLoadingComposer.svelte:13`  
  ```json
  {
    "file": "src/features/comments/components/CommentsPanelLoadingComposer.svelte",
    "line": 13,
    "tag": "<Skeleton",
    "classValue": "\"h-9 w-24\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentsPanelLoadingComposer.svelte:16`  
  ```json
  {
    "file": "src/features/comments/components/CommentsPanelLoadingComposer.svelte",
    "line": 16,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentsPanelLoadingComposer.svelte:17`  
  ```json
  {
    "file": "src/features/comments/components/CommentsPanelLoadingComposer.svelte",
    "line": 17,
    "tag": "<Skeleton",
    "classValue": "\"h-36 w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentsPanelLoadingComposer.svelte:19`  
  ```json
  {
    "file": "src/features/comments/components/CommentsPanelLoadingComposer.svelte",
    "line": 19,
    "tag": "<Skeleton",
    "classValue": "\"h-9 w-24\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentsPanelLoadingComposer.svelte:20`  
  ```json
  {
    "file": "src/features/comments/components/CommentsPanelLoadingComposer.svelte",
    "line": 20,
    "tag": "<Skeleton",
    "classValue": "\"h-9 w-20\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentsThreadSection.svelte:62`  
  ```json
  {
    "file": "src/features/comments/components/CommentsThreadSection.svelte",
    "line": 62,
    "tag": "<Skeleton",
    "classValue": "\"h-24 w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentsThreadSection.svelte:63`  
  ```json
  {
    "file": "src/features/comments/components/CommentsThreadSection.svelte",
    "line": 63,
    "tag": "<Skeleton",
    "classValue": "\"h-24 w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/comments/components/CommentsThreadSection.svelte:66`  
  ```json
  {
    "file": "src/features/comments/components/CommentsThreadSection.svelte",
    "line": 66,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-24\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/AnonymousLinksGroup.svelte:29`  
  ```json
  {
    "file": "src/features/dashboard/components/AnonymousLinksGroup.svelte",
    "line": 29,
    "tag": "<Table.Cell",
    "classValue": "\"p-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/AnonymousLinksTab.svelte:38`  
  ```json
  {
    "file": "src/features/dashboard/components/AnonymousLinksTab.svelte",
    "line": 38,
    "tag": "<Empty.Root",
    "classValue": "\"items-start text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/AnonymousLinksTab.svelte:39`  
  ```json
  {
    "file": "src/features/dashboard/components/AnonymousLinksTab.svelte",
    "line": 39,
    "tag": "<Empty.Header",
    "classValue": "\"items-start text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/AnonymousLinksTab.svelte:47`  
  ```json
  {
    "file": "src/features/dashboard/components/AnonymousLinksTab.svelte",
    "line": 47,
    "tag": "<Button",
    "classValue": "\"h-auto p-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/AnonymousLinksToolbar.svelte:44`  
  ```json
  {
    "file": "src/features/dashboard/components/AnonymousLinksToolbar.svelte",
    "line": 44,
    "tag": "<Field.Group",
    "classValue": "\"min-w-60 flex-1 max-w-xl gap-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/AnonymousLinksToolbar.svelte:46`  
  ```json
  {
    "file": "src/features/dashboard/components/AnonymousLinksToolbar.svelte",
    "line": 46,
    "tag": "<Field.Label",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/BusCampusPickerGroup.svelte:25`  
  ```json
  {
    "file": "src/features/dashboard/components/BusCampusPickerGroup.svelte",
    "line": 25,
    "tag": "<ToggleGroup.Root",
    "classValue": "\"grid w-full grid-cols-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/BusCampusPickerGroup.svelte:35`  
  ```json
  {
    "file": "src/features/dashboard/components/BusCampusPickerGroup.svelte",
    "line": 35,
    "tag": "<ToggleGroup.Item",
    "classValue": "\"w-full justify-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/BusTab.svelte:130`  
  ```json
  {
    "file": "src/features/dashboard/components/BusTab.svelte",
    "line": 130,
    "tag": "<Empty.Root",
    "classValue": "\"lg:col-span-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/BusTabRouteTable.svelte:26`  
  ```json
  {
    "file": "src/features/dashboard/components/BusTabRouteTable.svelte",
    "line": 26,
    "tag": "<Table.Root",
    "classValue": "\"min-w-[var(--table-min-width)]\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/BusTabRouteTable.svelte:30`  
  ```json
  {
    "file": "src/features/dashboard/components/BusTabRouteTable.svelte",
    "line": 30,
    "tag": "<Table.Head",
    "classValue": "{index === 0\n                    ? \"text-left\"\n                    : index === stopColumns.length - 1\n                      ? \"text-right\"\n                      : \"text-center\"}",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/BusTabRouteTable.svelte:46`  
  ```json
  {
    "file": "src/features/dashboard/components/BusTabRouteTable.svelte",
    "line": 46,
    "tag": "<Table.Row",
    "classValue": "{cn(\n                  trip.status === \"departed\" ? \"opacity-60\" : undefined,\n                  isNextTrip ? \"bg-muted/70 hover:bg-muted\" : undefined,\n                )}",
    "styleValue": null,
    "decision": "review",
    "action": "inspect dynamic expression; convert styling tokens to variants or theme tokens",
    "reason": "dynamic class expression may contain styling overrides: opacity-60, bg-muted/70, bg-muted"
  }
  ```

- `src/features/dashboard/components/BusTabRouteTable.svelte:54`  
  ```json
  {
    "file": "src/features/dashboard/components/BusTabRouteTable.svelte",
    "line": 54,
    "tag": "<Table.Cell",
    "classValue": "{cn(\n                      index === 0\n                        ? \"text-left\"\n                        : index === stopColumns.length - 1\n                          ? \"text-right\"\n                          : \"text-center\",\n                    )}",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/BusTabSettings.svelte:31`  
  ```json
  {
    "file": "src/features/dashboard/components/BusTabSettings.svelte",
    "line": 31,
    "tag": "<Field.Group",
    "classValue": "\"gap-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/BusTabSettings.svelte:33`  
  ```json
  {
    "file": "src/features/dashboard/components/BusTabSettings.svelte",
    "line": 33,
    "tag": "<Field.Legend",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/BusTabSettings.svelte:34`  
  ```json
  {
    "file": "src/features/dashboard/components/BusTabSettings.svelte",
    "line": 34,
    "tag": "<Field.Group",
    "classValue": "\"gap-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/BusTabSettings.svelte:45`  
  ```json
  {
    "file": "src/features/dashboard/components/BusTabSettings.svelte",
    "line": 45,
    "tag": "<Button",
    "classValue": "\"w-full justify-center\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/BusTabSettings.svelte:72`  
  ```json
  {
    "file": "src/features/dashboard/components/BusTabSettings.svelte",
    "line": 72,
    "tag": "<Field.Group",
    "classValue": "\"gap-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/BusTabSettings.svelte:77`  
  ```json
  {
    "file": "src/features/dashboard/components/BusTabSettings.svelte",
    "line": 77,
    "tag": "<ToggleGroup.Root",
    "classValue": "\"grid w-full grid-cols-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/BusTabSettings.svelte:123`  
  ```json
  {
    "file": "src/features/dashboard/components/BusTabSettings.svelte",
    "line": 123,
    "tag": "<Field.Description",
    "classValue": "{busPreferenceSaveState === \"error\" ? \"text-destructive\" : undefined}",
    "styleValue": null,
    "decision": "review",
    "action": "inspect dynamic expression; convert styling tokens to variants or theme tokens",
    "reason": "dynamic class expression may contain styling overrides: text-destructive"
  }
  ```

- `src/features/dashboard/components/CalendarTab.svelte:122`  
  ```json
  {
    "file": "src/features/dashboard/components/CalendarTab.svelte",
    "line": 122,
    "tag": "<Empty.Root",
    "classValue": "\"items-start text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/CalendarTab.svelte:123`  
  ```json
  {
    "file": "src/features/dashboard/components/CalendarTab.svelte",
    "line": 123,
    "tag": "<Empty.Header",
    "classValue": "\"items-start text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/CalendarTabNavigationControls.svelte:29`  
  ```json
  {
    "file": "src/features/dashboard/components/CalendarTabNavigationControls.svelte",
    "line": 29,
    "tag": "<ButtonGroup.Text",
    "classValue": "\"h-9\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/CalendarTabNavigationControls.svelte:39`  
  ```json
  {
    "file": "src/features/dashboard/components/CalendarTabNavigationControls.svelte",
    "line": 39,
    "tag": "<ButtonGroup.Text",
    "classValue": "\"h-9\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/CalendarTabNavigationControls.svelte:63`  
  ```json
  {
    "file": "src/features/dashboard/components/CalendarTabNavigationControls.svelte",
    "line": 63,
    "tag": "<ButtonGroup.Text",
    "classValue": "\"h-9\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/CalendarTabToolbar.svelte:70`  
  ```json
  {
    "file": "src/features/dashboard/components/CalendarTabToolbar.svelte",
    "line": 70,
    "tag": "<Button",
    "classValue": "\"min-w-28\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/DashboardLinkVisitAction.svelte:39`  
  ```json
  {
    "file": "src/features/dashboard/components/DashboardLinkVisitAction.svelte",
    "line": 39,
    "tag": "<Item.Root",
    "classValue": "{itemClass}",
    "styleValue": null,
    "decision": "keep",
    "action": "no class tokens to remediate",
    "reason": "empty or expression-only class value with no static styling tokens"
  }
  ```

- `src/features/dashboard/components/DashboardLinkVisitAction.svelte:42`  
  ```json
  {
    "file": "src/features/dashboard/components/DashboardLinkVisitAction.svelte",
    "line": 42,
    "tag": "<Item.Media",
    "classValue": "\"size-8\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/DashboardLinkVisitAction.svelte:49`  
  ```json
  {
    "file": "src/features/dashboard/components/DashboardLinkVisitAction.svelte",
    "line": 49,
    "tag": "<Item.Content",
    "classValue": "{contentClass}",
    "styleValue": null,
    "decision": "keep",
    "action": "no class tokens to remediate",
    "reason": "empty or expression-only class value with no static styling tokens"
  }
  ```

- `src/features/dashboard/components/DashboardLinkVisitAction.svelte:50`  
  ```json
  {
    "file": "src/features/dashboard/components/DashboardLinkVisitAction.svelte",
    "line": 50,
    "tag": "<Item.Title",
    "classValue": "{titleClass}",
    "styleValue": null,
    "decision": "keep",
    "action": "no class tokens to remediate",
    "reason": "empty or expression-only class value with no static styling tokens"
  }
  ```

- `src/features/dashboard/components/DashboardLinkVisitAction.svelte:51`  
  ```json
  {
    "file": "src/features/dashboard/components/DashboardLinkVisitAction.svelte",
    "line": 51,
    "tag": "<Item.Description",
    "classValue": "{descriptionClass}",
    "styleValue": null,
    "decision": "keep",
    "action": "no class tokens to remediate",
    "reason": "empty or expression-only class value with no static styling tokens"
  }
  ```

- `src/features/dashboard/components/DashboardNoSubscriptionsState.svelte:20`  
  ```json
  {
    "file": "src/features/dashboard/components/DashboardNoSubscriptionsState.svelte",
    "line": 20,
    "tag": "<Empty.Root",
    "classValue": "{cn(\n    \"items-start text-left\",\n    className,\n  )}",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/DashboardNoSubscriptionsState.svelte:26`  
  ```json
  {
    "file": "src/features/dashboard/components/DashboardNoSubscriptionsState.svelte",
    "line": 26,
    "tag": "<Empty.Header",
    "classValue": "\"items-start text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/DashboardNoSubscriptionsState.svelte:30`  
  ```json
  {
    "file": "src/features/dashboard/components/DashboardNoSubscriptionsState.svelte",
    "line": 30,
    "tag": "<Empty.Content",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/DashboardNoSubscriptionsState.svelte:33`  
  ```json
  {
    "file": "src/features/dashboard/components/DashboardNoSubscriptionsState.svelte",
    "line": 33,
    "tag": "<Button",
    "classValue": "\"min-w-28\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/ExamsCardsView.svelte:58`  
  ```json
  {
    "file": "src/features/dashboard/components/ExamsCardsView.svelte",
    "line": 58,
    "tag": "<Card.Footer",
    "classValue": "\"flex-wrap justify-between gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/ExamsListView.svelte:24`  
  ```json
  {
    "file": "src/features/dashboard/components/ExamsListView.svelte",
    "line": 24,
    "tag": "<Table.Head",
    "classValue": "\"text-center\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/ExamsListView.svelte:25`  
  ```json
  {
    "file": "src/features/dashboard/components/ExamsListView.svelte",
    "line": 25,
    "tag": "<Table.Head",
    "classValue": "\"text-center\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/ExamsListView.svelte:27`  
  ```json
  {
    "file": "src/features/dashboard/components/ExamsListView.svelte",
    "line": 27,
    "tag": "<Table.Head",
    "classValue": "\"text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/ExamsListView.svelte:33`  
  ```json
  {
    "file": "src/features/dashboard/components/ExamsListView.svelte",
    "line": 33,
    "tag": "<Table.Cell",
    "classValue": "\"max-w-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/ExamsListView.svelte:38`  
  ```json
  {
    "file": "src/features/dashboard/components/ExamsListView.svelte",
    "line": 38,
    "tag": "<Table.Cell",
    "classValue": "\"max-w-48 truncate\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/ExamsListView.svelte:39`  
  ```json
  {
    "file": "src/features/dashboard/components/ExamsListView.svelte",
    "line": 39,
    "tag": "<Table.Cell",
    "classValue": "\"text-center\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/ExamsListView.svelte:42`  
  ```json
  {
    "file": "src/features/dashboard/components/ExamsListView.svelte",
    "line": 42,
    "tag": "<Table.Cell",
    "classValue": "\"text-center\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/ExamsListView.svelte:43`  
  ```json
  {
    "file": "src/features/dashboard/components/ExamsListView.svelte",
    "line": 43,
    "tag": "<Table.Cell",
    "classValue": "\"max-w-56 truncate\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/ExamsTab.svelte:64`  
  ```json
  {
    "file": "src/features/dashboard/components/ExamsTab.svelte",
    "line": 64,
    "tag": "<Empty.Root",
    "classValue": "\"items-start text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/ExamsTab.svelte:65`  
  ```json
  {
    "file": "src/features/dashboard/components/ExamsTab.svelte",
    "line": 65,
    "tag": "<Empty.Header",
    "classValue": "\"items-start text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/ExamsTab.svelte:70`  
  ```json
  {
    "file": "src/features/dashboard/components/ExamsTab.svelte",
    "line": 70,
    "tag": "<Empty.Root",
    "classValue": "\"items-start text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/ExamsTab.svelte:71`  
  ```json
  {
    "file": "src/features/dashboard/components/ExamsTab.svelte",
    "line": 71,
    "tag": "<Empty.Header",
    "classValue": "\"items-start text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkCreateAdvancedDateFields.svelte:19`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkCreateAdvancedDateFields.svelte",
    "line": 19,
    "tag": "<Field.Group",
    "classValue": "\"grid gap-3 sm:grid-cols-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkCreateAdvancedDateFields.svelte:33`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkCreateAdvancedDateFields.svelte",
    "line": 33,
    "tag": "<ButtonGroup.Root",
    "classValue": "\"ml-auto max-w-full flex-wrap justify-end\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkCreateAdvancedDateFields.svelte:71`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkCreateAdvancedDateFields.svelte",
    "line": 71,
    "tag": "<ButtonGroup.Root",
    "classValue": "\"ml-auto max-w-full flex-wrap justify-end\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkCreateDialog.svelte:47`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkCreateDialog.svelte",
    "line": 47,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-lg sm:max-w-lg\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkCreateDueDateField.svelte:33`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkCreateDueDateField.svelte",
    "line": 33,
    "tag": "<ButtonGroup.Root",
    "classValue": "\"ml-auto max-w-full flex-wrap justify-end\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkCreateFormFields.svelte:48`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkCreateFormFields.svelte",
    "line": 48,
    "tag": "<Field.Group",
    "classValue": "\"gap-4 px-5 py-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkCreateFormFields.svelte:58`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkCreateFormFields.svelte",
    "line": 58,
    "tag": "<NativeSelect.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkCreateFormFields.svelte:119`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkCreateFormFields.svelte",
    "line": 119,
    "tag": "<Field.Legend",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkCreateFormFields.svelte:122`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkCreateFormFields.svelte",
    "line": 122,
    "tag": "<Field.Group",
    "classValue": "\"flex-row flex-wrap gap-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkCreateFormFields.svelte:123`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkCreateFormFields.svelte",
    "line": 123,
    "tag": "<Field.Field",
    "classValue": "\"w-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkCreateFormFields.svelte:133`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkCreateFormFields.svelte",
    "line": 133,
    "tag": "<Field.Field",
    "classValue": "\"w-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkDetailCommentsAside.svelte:24`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkDetailCommentsAside.svelte",
    "line": 24,
    "tag": "<Separator",
    "classValue": "\"mb-5 lg:hidden\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkDetailCommentsAside.svelte:26`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkDetailCommentsAside.svelte",
    "line": 26,
    "tag": "<Separator",
    "classValue": "\"hidden lg:block\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkDetailDescription.svelte:14`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkDetailDescription.svelte",
    "line": 14,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkDetailDialog.svelte:44`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkDetailDialog.svelte",
    "line": 44,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-5xl sm:max-w-5xl\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkDetailDialog.svelte:56`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkDetailDialog.svelte",
    "line": 56,
    "tag": "<ScrollArea",
    "classValue": "\"h-[min(70vh,44rem)]\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkDetailMetadata.svelte:19`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkDetailMetadata.svelte",
    "line": 19,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworkDetailMetadata.svelte:35`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworkDetailMetadata.svelte",
    "line": 35,
    "tag": "<Item.Group",
    "classValue": "\"grid gap-3 sm:grid-cols-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworksCardsView.svelte:28`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworksCardsView.svelte",
    "line": 28,
    "tag": "<Card.Root",
    "classValue": "\"group\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworksCardsView.svelte:64`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworksCardsView.svelte",
    "line": 64,
    "tag": "<Card.Footer",
    "classValue": "\"justify-end\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworksCardsView.svelte:79`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworksCardsView.svelte",
    "line": 79,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-24 md:col-span-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworksListView.svelte:31`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworksListView.svelte",
    "line": 31,
    "tag": "<Table.Head",
    "classValue": "\"text-center\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworksListView.svelte:33`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworksListView.svelte",
    "line": 33,
    "tag": "<Table.Head",
    "classValue": "\"text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworksListView.svelte:41`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworksListView.svelte",
    "line": 41,
    "tag": "<Table.Cell",
    "classValue": "\"max-w-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworksListView.svelte:52`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworksListView.svelte",
    "line": 52,
    "tag": "<Table.Cell",
    "classValue": "\"max-w-64\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworksListView.svelte:57`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworksListView.svelte",
    "line": 57,
    "tag": "<Table.Cell",
    "classValue": "\"text-center\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworksListView.svelte:84`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworksListView.svelte",
    "line": 84,
    "tag": "<Button",
    "classValue": "\"h-8 whitespace-nowrap\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworksListView.svelte:101`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworksListView.svelte",
    "line": 101,
    "tag": "<Table.Cell",
    "classValue": "\"p-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworksListView.svelte:102`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworksListView.svelte",
    "line": 102,
    "tag": "<Empty.Root",
    "classValue": "\"py-8\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/HomeworksTabToolbar.svelte:67`  
  ```json
  {
    "file": "src/features/dashboard/components/HomeworksTabToolbar.svelte",
    "line": 67,
    "tag": "<Button",
    "classValue": "\"h-9 min-w-28\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/LinksTab.svelte:48`  
  ```json
  {
    "file": "src/features/dashboard/components/LinksTab.svelte",
    "line": 48,
    "tag": "<Empty.Root",
    "classValue": "\"items-start text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/LinksTab.svelte:49`  
  ```json
  {
    "file": "src/features/dashboard/components/LinksTab.svelte",
    "line": 49,
    "tag": "<Empty.Header",
    "classValue": "\"items-start text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/LinksTab.svelte:63`  
  ```json
  {
    "file": "src/features/dashboard/components/LinksTab.svelte",
    "line": 63,
    "tag": "<Button",
    "classValue": "\"h-auto p-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/LinksTabList.svelte:25`  
  ```json
  {
    "file": "src/features/dashboard/components/LinksTabList.svelte",
    "line": 25,
    "tag": "<Table.Row",
    "classValue": "\"group\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/LinksTabList.svelte:26`  
  ```json
  {
    "file": "src/features/dashboard/components/LinksTabList.svelte",
    "line": 26,
    "tag": "<Table.Cell",
    "classValue": "\"p-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/LinksTabToolbar.svelte:44`  
  ```json
  {
    "file": "src/features/dashboard/components/LinksTabToolbar.svelte",
    "line": 44,
    "tag": "<Field.Group",
    "classValue": "\"min-w-60 flex-1 max-w-xl gap-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/LinksTabToolbar.svelte:46`  
  ```json
  {
    "file": "src/features/dashboard/components/LinksTabToolbar.svelte",
    "line": 46,
    "tag": "<Field.Label",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/OverviewExamSummaryCard.svelte:46`  
  ```json
  {
    "file": "src/features/dashboard/components/OverviewExamSummaryCard.svelte",
    "line": 46,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-24\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/OverviewHomeworkSummaryCard.svelte:42`  
  ```json
  {
    "file": "src/features/dashboard/components/OverviewHomeworkSummaryCard.svelte",
    "line": 42,
    "tag": "<Item.Actions",
    "classValue": "\"flex-col items-end gap-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/OverviewHomeworkSummaryCard.svelte:50`  
  ```json
  {
    "file": "src/features/dashboard/components/OverviewHomeworkSummaryCard.svelte",
    "line": 50,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-24\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/OverviewLinksGrid.svelte:49`  
  ```json
  {
    "file": "src/features/dashboard/components/OverviewLinksGrid.svelte",
    "line": 49,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-24 md:col-span-2 lg:col-span-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/OverviewTermSelectionCard.svelte:13`  
  ```json
  {
    "file": "src/features/dashboard/components/OverviewTermSelectionCard.svelte",
    "line": 13,
    "tag": "<Card.Header",
    "classValue": "\"items-start gap-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/OverviewTermSelectionCard.svelte:16`  
  ```json
  {
    "file": "src/features/dashboard/components/OverviewTermSelectionCard.svelte",
    "line": 16,
    "tag": "<Card.Description",
    "classValue": "\"mt-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/OverviewTodayCard.svelte:32`  
  ```json
  {
    "file": "src/features/dashboard/components/OverviewTodayCard.svelte",
    "line": 32,
    "tag": "<Item.Group",
    "classValue": "\"grid gap-2 md:grid-cols-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/OverviewTodayCard.svelte:77`  
  ```json
  {
    "file": "src/features/dashboard/components/OverviewTodayCard.svelte",
    "line": 77,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-24 md:col-span-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/OverviewTodayOverdueCards.svelte:55`  
  ```json
  {
    "file": "src/features/dashboard/components/OverviewTodayOverdueCards.svelte",
    "line": 55,
    "tag": "<Item.Group",
    "classValue": "\"grid gap-2 md:grid-cols-2 xl:grid-cols-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/OverviewTodayOverdueCards.svelte:88`  
  ```json
  {
    "file": "src/features/dashboard/components/OverviewTodayOverdueCards.svelte",
    "line": 88,
    "tag": "<Item.Description",
    "classValue": "\"flex flex-wrap gap-1.5\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/OverviewTodayOverdueCards.svelte:109`  
  ```json
  {
    "file": "src/features/dashboard/components/OverviewTodayOverdueCards.svelte",
    "line": 109,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-24 md:col-span-2 xl:col-span-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/OverviewTodoSummaryCard.svelte:55`  
  ```json
  {
    "file": "src/features/dashboard/components/OverviewTodoSummaryCard.svelte",
    "line": 55,
    "tag": "<Item.Description",
    "classValue": "\"flex flex-wrap gap-1.5\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/OverviewTodoSummaryCard.svelte:69`  
  ```json
  {
    "file": "src/features/dashboard/components/OverviewTodoSummaryCard.svelte",
    "line": 69,
    "tag": "<Item.Actions",
    "classValue": "\"sm:text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/OverviewTodoSummaryCard.svelte:75`  
  ```json
  {
    "file": "src/features/dashboard/components/OverviewTodoSummaryCard.svelte",
    "line": 75,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-24\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SignedDashboardTabsNav.svelte:28`  
  ```json
  {
    "file": "src/features/dashboard/components/SignedDashboardTabsNav.svelte",
    "line": 28,
    "tag": "<Button",
    "classValue": "{id === \"bus\" ? \"md:ml-auto\" : \"\"}",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsBulkImportConfirmDialog.svelte:37`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsBulkImportConfirmDialog.svelte",
    "line": 37,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-2xl sm:max-w-2xl\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsBulkImportConfirmDialog.svelte:53`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsBulkImportConfirmDialog.svelte",
    "line": 53,
    "tag": "<ScrollArea",
    "classValue": "\"h-[min(60vh,24rem)]\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsBulkImportDialog.svelte:37`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsBulkImportDialog.svelte",
    "line": 37,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-lg sm:max-w-lg\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsBulkImportDialog.svelte:46`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsBulkImportDialog.svelte",
    "line": 46,
    "tag": "<Field.Group",
    "classValue": "\"gap-4 px-5 py-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsBulkImportDialog.svelte:56`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsBulkImportDialog.svelte",
    "line": 56,
    "tag": "<NativeSelect.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsBulkImportMatchedList.svelte:23`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsBulkImportMatchedList.svelte",
    "line": 23,
    "tag": "<Field.Legend",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsBulkImportMatchedList.svelte:26`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsBulkImportMatchedList.svelte",
    "line": 26,
    "tag": "<Field.Group",
    "classValue": "\"gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsBulkImportMatchedList.svelte:42`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsBulkImportMatchedList.svelte",
    "line": 42,
    "tag": "<Field.Label",
    "classValue": "\"cursor-pointer\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsBulkImportMatchedList.svelte:62`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsBulkImportMatchedList.svelte",
    "line": 62,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-20 p-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsSectionGroup.svelte:33`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsSectionGroup.svelte",
    "line": 33,
    "tag": "<Item.Group",
    "classValue": "\"min-w-0 gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsSectionGroup.svelte:35`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsSectionGroup.svelte",
    "line": 35,
    "tag": "<Item.Root",
    "classValue": "\"group/section-row items-start md:flex-nowrap\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsSectionGroup.svelte:40`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsSectionGroup.svelte",
    "line": 40,
    "tag": "<Item.Content",
    "classValue": "\"min-w-0 md:min-w-80\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsSectionGroup.svelte:54`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsSectionGroup.svelte",
    "line": 54,
    "tag": "<Item.Content",
    "classValue": "\"min-w-0 basis-full md:basis-64\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsSectionGroup.svelte:55`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsSectionGroup.svelte",
    "line": 55,
    "tag": "<Item.Description",
    "classValue": "\"md:sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsSectionGroup.svelte:63`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsSectionGroup.svelte",
    "line": 63,
    "tag": "<Item.Content",
    "classValue": "\"basis-auto grow-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsSectionGroup.svelte:64`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsSectionGroup.svelte",
    "line": 64,
    "tag": "<Item.Description",
    "classValue": "\"md:sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsSectionGroup.svelte:68`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsSectionGroup.svelte",
    "line": 68,
    "tag": "<Item.Actions",
    "classValue": "\"ms-auto\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsSectionGroup.svelte:69`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsSectionGroup.svelte",
    "line": 69,
    "tag": "<Button",
    "classValue": "{pendingRemoveSectionId === section.id\n            ? undefined\n            : \"opacity-100 md:opacity-0 md:group-hover/section-row:opacity-100 md:group-focus-within/section-row:opacity-100\"}",
    "styleValue": null,
    "decision": "review",
    "action": "inspect dynamic expression; convert styling tokens to variants or theme tokens",
    "reason": "dynamic class expression may contain styling overrides: opacity-100, opacity-0"
  }
  ```

- `src/features/dashboard/components/SubscriptionsTabToolbar.svelte:12`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsTabToolbar.svelte",
    "line": 12,
    "tag": "<Button",
    "classValue": "\"min-w-28\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/SubscriptionsTabToolbar.svelte:16`  
  ```json
  {
    "file": "src/features/dashboard/components/SubscriptionsTabToolbar.svelte",
    "line": 16,
    "tag": "<Button",
    "classValue": "\"min-w-28\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodoCreateDialog.svelte:33`  
  ```json
  {
    "file": "src/features/dashboard/components/TodoCreateDialog.svelte",
    "line": 33,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-lg sm:max-w-lg\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodoCreateDialog.svelte:41`  
  ```json
  {
    "file": "src/features/dashboard/components/TodoCreateDialog.svelte",
    "line": 41,
    "tag": "<Field.Group",
    "classValue": "\"gap-4 px-5 py-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodoDetailDialog.svelte:33`  
  ```json
  {
    "file": "src/features/dashboard/components/TodoDetailDialog.svelte",
    "line": 33,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-lg sm:max-w-lg\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodoEditDialog.svelte:37`  
  ```json
  {
    "file": "src/features/dashboard/components/TodoEditDialog.svelte",
    "line": 37,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-lg sm:max-w-lg\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodoEditDialog.svelte:46`  
  ```json
  {
    "file": "src/features/dashboard/components/TodoEditDialog.svelte",
    "line": 46,
    "tag": "<Field.Group",
    "classValue": "\"gap-4 px-5 py-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodoEmptyState.svelte:8`  
  ```json
  {
    "file": "src/features/dashboard/components/TodoEmptyState.svelte",
    "line": 8,
    "tag": "<Empty.Root",
    "classValue": "\"md:col-span-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodoFormFields.svelte:46`  
  ```json
  {
    "file": "src/features/dashboard/components/TodoFormFields.svelte",
    "line": 46,
    "tag": "<NativeSelect.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodosCardsView.svelte:31`  
  ```json
  {
    "file": "src/features/dashboard/components/TodosCardsView.svelte",
    "line": 31,
    "tag": "<Card.Root",
    "classValue": "\"group\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodosCardsView.svelte:54`  
  ```json
  {
    "file": "src/features/dashboard/components/TodosCardsView.svelte",
    "line": 54,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodosCardsView.svelte:71`  
  ```json
  {
    "file": "src/features/dashboard/components/TodosCardsView.svelte",
    "line": 71,
    "tag": "<Card.Footer",
    "classValue": "\"justify-end gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodosListView.svelte:31`  
  ```json
  {
    "file": "src/features/dashboard/components/TodosListView.svelte",
    "line": 31,
    "tag": "<Table.Head",
    "classValue": "\"text-center\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodosListView.svelte:32`  
  ```json
  {
    "file": "src/features/dashboard/components/TodosListView.svelte",
    "line": 32,
    "tag": "<Table.Head",
    "classValue": "\"text-center\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodosListView.svelte:33`  
  ```json
  {
    "file": "src/features/dashboard/components/TodosListView.svelte",
    "line": 33,
    "tag": "<Table.Head",
    "classValue": "\"text-right\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodosListView.svelte:41`  
  ```json
  {
    "file": "src/features/dashboard/components/TodosListView.svelte",
    "line": 41,
    "tag": "<Table.Cell",
    "classValue": "\"max-w-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodosListView.svelte:53`  
  ```json
  {
    "file": "src/features/dashboard/components/TodosListView.svelte",
    "line": 53,
    "tag": "<Table.Cell",
    "classValue": "\"text-center\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodosListView.svelte:64`  
  ```json
  {
    "file": "src/features/dashboard/components/TodosListView.svelte",
    "line": 64,
    "tag": "<Table.Cell",
    "classValue": "\"text-center\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodosListView.svelte:69`  
  ```json
  {
    "file": "src/features/dashboard/components/TodosListView.svelte",
    "line": 69,
    "tag": "<Button",
    "classValue": "\"h-8\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodosListView.svelte:78`  
  ```json
  {
    "file": "src/features/dashboard/components/TodosListView.svelte",
    "line": 78,
    "tag": "<Button",
    "classValue": "\"h-8\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodosListView.svelte:98`  
  ```json
  {
    "file": "src/features/dashboard/components/TodosListView.svelte",
    "line": 98,
    "tag": "<Table.Cell",
    "classValue": "\"p-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodosListView.svelte:99`  
  ```json
  {
    "file": "src/features/dashboard/components/TodosListView.svelte",
    "line": 99,
    "tag": "<Empty.Root",
    "classValue": "\"py-8\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/dashboard/components/TodosTabToolbar.svelte:67`  
  ```json
  {
    "file": "src/features/dashboard/components/TodosTabToolbar.svelte",
    "line": 67,
    "tag": "<Button",
    "classValue": "\"h-9 min-w-28\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/descriptions/components/DescriptionCard.svelte:109`  
  ```json
  {
    "file": "src/features/descriptions/components/DescriptionCard.svelte",
    "line": 109,
    "tag": "<Card.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/descriptions/components/DescriptionCard.svelte:120`  
  ```json
  {
    "file": "src/features/descriptions/components/DescriptionCard.svelte",
    "line": 120,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-5\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/descriptions/components/DescriptionCardHeader.svelte:21`  
  ```json
  {
    "file": "src/features/descriptions/components/DescriptionCardHeader.svelte",
    "line": 21,
    "tag": "<Card.Title",
    "classValue": "\"min-w-0 break-words\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/descriptions/components/DescriptionEditPanel.svelte:25`  
  ```json
  {
    "file": "src/features/descriptions/components/DescriptionEditPanel.svelte",
    "line": 25,
    "tag": "<Field.Group",
    "classValue": "\"gap-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/descriptions/components/DescriptionHistoryList.svelte:64`  
  ```json
  {
    "file": "src/features/descriptions/components/DescriptionHistoryList.svelte",
    "line": 64,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/descriptions/components/DescriptionHistoryList.svelte:66`  
  ```json
  {
    "file": "src/features/descriptions/components/DescriptionHistoryList.svelte",
    "line": 66,
    "tag": "<Item.Content",
    "classValue": "\"gap-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/descriptions/components/DescriptionHistoryList.svelte:72`  
  ```json
  {
    "file": "src/features/descriptions/components/DescriptionHistoryList.svelte",
    "line": 72,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/descriptions/components/DescriptionHistoryList.svelte:73`  
  ```json
  {
    "file": "src/features/descriptions/components/DescriptionHistoryList.svelte",
    "line": 73,
    "tag": "<Item.Content",
    "classValue": "\"gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/descriptions/components/DescriptionHistoryList.svelte:75`  
  ```json
  {
    "file": "src/features/descriptions/components/DescriptionHistoryList.svelte",
    "line": 75,
    "tag": "<ScrollArea",
    "classValue": "\"h-40\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/descriptions/components/DescriptionHistoryList.svelte:88`  
  ```json
  {
    "file": "src/features/descriptions/components/DescriptionHistoryList.svelte",
    "line": 88,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/descriptions/components/DescriptionHistoryList.svelte:89`  
  ```json
  {
    "file": "src/features/descriptions/components/DescriptionHistoryList.svelte",
    "line": 89,
    "tag": "<Item.Content",
    "classValue": "\"gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/descriptions/components/DescriptionHistoryList.svelte:91`  
  ```json
  {
    "file": "src/features/descriptions/components/DescriptionHistoryList.svelte",
    "line": 91,
    "tag": "<ScrollArea",
    "classValue": "\"h-40\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/descriptions/components/DescriptionReadPanel.svelte:50`  
  ```json
  {
    "file": "src/features/descriptions/components/DescriptionReadPanel.svelte",
    "line": 50,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-24\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:159`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 159,
    "tag": "<Card.Root",
    "classValue": "\"overflow-hidden\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:160`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 160,
    "tag": "<Card.Header",
    "classValue": "\"p-4 sm:p-5\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:179`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 179,
    "tag": "<Card.Description",
    "classValue": "\"max-w-3xl\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:184`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 184,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-5 px-4 sm:px-5\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:185`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 185,
    "tag": "<Item.Group",
    "classValue": "\"grid gap-2 sm:grid-cols-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:187`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 187,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:197`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 197,
    "tag": "<Card.Footer",
    "classValue": "\"flex-wrap gap-2 px-4 sm:px-5\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:220`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 220,
    "tag": "<Card.Root",
    "classValue": "\"overflow-hidden\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:221`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 221,
    "tag": "<Card.Header",
    "classValue": "\"p-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:227`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 227,
    "tag": "<Card.Title",
    "classValue": "\"truncate\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:232`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 232,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-3 p-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:243`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 243,
    "tag": "<Item.Group",
    "classValue": "\"gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:252`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 252,
    "tag": "<Item.Actions",
    "classValue": "\"shrink-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:264`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 264,
    "tag": "<Card.Header",
    "classValue": "\"p-4 pb-0 sm:p-5 sm:pb-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:267`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 267,
    "tag": "<Card.Content",
    "classValue": "\"p-4 sm:p-5\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:268`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 268,
    "tag": "<Item.Group",
    "classValue": "\"grid gap-2 sm:grid-cols-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:270`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 270,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:285`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 285,
    "tag": "<Card.Header",
    "classValue": "\"p-4 pb-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:288`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 288,
    "tag": "<Card.Content",
    "classValue": "\"p-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/mobile-app/components/MobileAppPage.svelte:289`  
  ```json
  {
    "file": "src/features/mobile-app/components/MobileAppPage.svelte",
    "line": 289,
    "tag": "<Item.Group",
    "classValue": "\"gap-1.5\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/DeviceApprovalPanel.svelte:24`  
  ```json
  {
    "file": "src/features/oauth/components/DeviceApprovalPanel.svelte",
    "line": 24,
    "tag": "<Badge",
    "classValue": "\"mb-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/DeviceApprovalPanel.svelte:35`  
  ```json
  {
    "file": "src/features/oauth/components/DeviceApprovalPanel.svelte",
    "line": 35,
    "tag": "<Alert.Description",
    "classValue": "\"mt-2 flex flex-wrap gap-2 text-balance\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/DeviceApprovalPanel.svelte:37`  
  ```json
  {
    "file": "src/features/oauth/components/DeviceApprovalPanel.svelte",
    "line": 37,
    "tag": "<Badge",
    "classValue": "\"max-w-full whitespace-normal break-all text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/DeviceApprovalPanel.svelte:47`  
  ```json
  {
    "file": "src/features/oauth/components/DeviceApprovalPanel.svelte",
    "line": 47,
    "tag": "<Alert.Description",
    "classValue": "\"mt-2 flex flex-wrap gap-2 text-balance\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/DeviceApprovalPanel.svelte:49`  
  ```json
  {
    "file": "src/features/oauth/components/DeviceApprovalPanel.svelte",
    "line": 49,
    "tag": "<Badge",
    "classValue": "\"max-w-full whitespace-normal break-all text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/DeviceApprovalPanel.svelte:60`  
  ```json
  {
    "file": "src/features/oauth/components/DeviceApprovalPanel.svelte",
    "line": 60,
    "tag": "<Button",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/DeviceApprovalPanel.svelte:67`  
  ```json
  {
    "file": "src/features/oauth/components/DeviceApprovalPanel.svelte",
    "line": 67,
    "tag": "<Button",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/DeviceCodeForm.svelte:25`  
  ```json
  {
    "file": "src/features/oauth/components/DeviceCodeForm.svelte",
    "line": 25,
    "tag": "<Badge",
    "classValue": "\"mb-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/DeviceCodeForm.svelte:35`  
  ```json
  {
    "file": "src/features/oauth/components/DeviceCodeForm.svelte",
    "line": 35,
    "tag": "<InputOTP.Root",
    "classValue": "\"justify-center\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/DeviceResultPanel.svelte:10`  
  ```json
  {
    "file": "src/features/oauth/components/DeviceResultPanel.svelte",
    "line": 10,
    "tag": "<Badge",
    "classValue": "\"mx-auto\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/DeviceSidePanel.svelte:12`  
  ```json
  {
    "file": "src/features/oauth/components/DeviceSidePanel.svelte",
    "line": 12,
    "tag": "<Card.Header",
    "classValue": "\"content-between gap-8 bg-subtle p-6\"",
    "styleValue": null,
    "decision": "convert",
    "action": "keep layout tokens (content-between, gap-8, p-6); convert styling tokens: bg-subtle",
    "reason": "mixes layout and styling tokens"
  }
  ```

- `src/features/oauth/components/DeviceSidePanel.svelte:15`  
  ```json
  {
    "file": "src/features/oauth/components/DeviceSidePanel.svelte",
    "line": 15,
    "tag": "<Item.Media",
    "classValue": "\"size-12\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/DeviceSidePanel.svelte:18`  
  ```json
  {
    "file": "src/features/oauth/components/DeviceSidePanel.svelte",
    "line": 18,
    "tag": "<Item.Content",
    "classValue": "\"gap-1\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/DeviceSidePanel.svelte:19`  
  ```json
  {
    "file": "src/features/oauth/components/DeviceSidePanel.svelte",
    "line": 19,
    "tag": "<Badge",
    "classValue": "\"w-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/DeviceSidePanel.svelte:27`  
  ```json
  {
    "file": "src/features/oauth/components/DeviceSidePanel.svelte",
    "line": 27,
    "tag": "<Alert.Description",
    "classValue": "\"break-words\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/OAuthAuthorizeConsentPanel.svelte:40`  
  ```json
  {
    "file": "src/features/oauth/components/OAuthAuthorizeConsentPanel.svelte",
    "line": 40,
    "tag": "<Field.Legend",
    "classValue": "\"flex min-w-0 items-center gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/OAuthAuthorizeConsentPanel.svelte:55`  
  ```json
  {
    "file": "src/features/oauth/components/OAuthAuthorizeConsentPanel.svelte",
    "line": 55,
    "tag": "<Field.Label",
    "classValue": "\"w-full cursor-pointer flex-wrap items-start gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/OAuthAuthorizeConsentPanel.svelte:59`  
  ```json
  {
    "file": "src/features/oauth/components/OAuthAuthorizeConsentPanel.svelte",
    "line": 59,
    "tag": "<Badge",
    "classValue": "\"max-w-full whitespace-normal break-all text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/OAuthAuthorizeConsentPanel.svelte:61`  
  ```json
  {
    "file": "src/features/oauth/components/OAuthAuthorizeConsentPanel.svelte",
    "line": 61,
    "tag": "<Field.Description",
    "classValue": "\"break-words\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/OAuthAuthorizeConsentPanel.svelte:76`  
  ```json
  {
    "file": "src/features/oauth/components/OAuthAuthorizeConsentPanel.svelte",
    "line": 76,
    "tag": "<Button",
    "classValue": "\"h-10 w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/OAuthAuthorizeConsentPanel.svelte:88`  
  ```json
  {
    "file": "src/features/oauth/components/OAuthAuthorizeConsentPanel.svelte",
    "line": 88,
    "tag": "<Button",
    "classValue": "\"h-10 w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/OAuthAuthorizePage.svelte:42`  
  ```json
  {
    "file": "src/features/oauth/components/OAuthAuthorizePage.svelte",
    "line": 42,
    "tag": "<Card.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/OAuthAuthorizePage.svelte:43`  
  ```json
  {
    "file": "src/features/oauth/components/OAuthAuthorizePage.svelte",
    "line": 43,
    "tag": "<Card.Header",
    "classValue": "\"gap-5 p-6\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/OAuthAuthorizePage.svelte:53`  
  ```json
  {
    "file": "src/features/oauth/components/OAuthAuthorizePage.svelte",
    "line": 53,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-5 p-6\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/OAuthAuthorizeSidePanel.svelte:8`  
  ```json
  {
    "file": "src/features/oauth/components/OAuthAuthorizeSidePanel.svelte",
    "line": 8,
    "tag": "<Item.Root",
    "classValue": "\"items-center\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/OAuthAuthorizeSidePanel.svelte:9`  
  ```json
  {
    "file": "src/features/oauth/components/OAuthAuthorizeSidePanel.svelte",
    "line": 9,
    "tag": "<Item.Media",
    "classValue": "\"size-11\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/OAuthAuthorizeSidePanel.svelte:12`  
  ```json
  {
    "file": "src/features/oauth/components/OAuthAuthorizeSidePanel.svelte",
    "line": 12,
    "tag": "<Item.Content",
    "classValue": "\"gap-1\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/OAuthAuthorizeSidePanel.svelte:13`  
  ```json
  {
    "file": "src/features/oauth/components/OAuthAuthorizeSidePanel.svelte",
    "line": 13,
    "tag": "<Badge",
    "classValue": "\"w-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/OAuthDevicePage.svelte:56`  
  ```json
  {
    "file": "src/features/oauth/components/OAuthDevicePage.svelte",
    "line": 56,
    "tag": "<Card.Root",
    "classValue": "\"grid gap-0 p-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/oauth/components/OAuthDevicePage.svelte:59`  
  ```json
  {
    "file": "src/features/oauth/components/OAuthDevicePage.svelte",
    "line": 59,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-5 p-6\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/profile/components/ProfileContributionCard.svelte:49`  
  ```json
  {
    "file": "src/features/profile/components/ProfileContributionCard.svelte",
    "line": 49,
    "tag": "<Card.Root",
    "classValue": "\"min-w-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/profile/components/ProfileContributionCard.svelte:57`  
  ```json
  {
    "file": "src/features/profile/components/ProfileContributionCard.svelte",
    "line": 57,
    "tag": "<Card.Description",
    "classValue": "\"mt-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/profile/components/ProfileContributionCard.svelte:62`  
  ```json
  {
    "file": "src/features/profile/components/ProfileContributionCard.svelte",
    "line": 62,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-5\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/profile/components/ProfileSummaryCard.svelte:21`  
  ```json
  {
    "file": "src/features/profile/components/ProfileSummaryCard.svelte",
    "line": 21,
    "tag": "<Card.Header",
    "classValue": "\"gap-4 sm:grid-cols-[auto_minmax(0,1fr)]\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/profile/components/ProfileSummaryCard.svelte:22`  
  ```json
  {
    "file": "src/features/profile/components/ProfileSummaryCard.svelte",
    "line": 22,
    "tag": "<Avatar.Root",
    "classValue": "\"size-20 shrink-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/profile/components/ProfileSummaryCard.svelte:29`  
  ```json
  {
    "file": "src/features/profile/components/ProfileSummaryCard.svelte",
    "line": 29,
    "tag": "<Card.Title",
    "classValue": "\"truncate\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/profile/components/ProfileSummaryCard.svelte:33`  
  ```json
  {
    "file": "src/features/profile/components/ProfileSummaryCard.svelte",
    "line": 33,
    "tag": "<Card.Description",
    "classValue": "\"truncate\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/profile/components/ProfileSummaryCard.svelte:36`  
  ```json
  {
    "file": "src/features/profile/components/ProfileSummaryCard.svelte",
    "line": 36,
    "tag": "<Badge",
    "classValue": "\"mt-2 h-auto max-w-full shrink justify-start whitespace-normal break-all\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/profile/components/ProfileSummaryCard.svelte:43`  
  ```json
  {
    "file": "src/features/profile/components/ProfileSummaryCard.svelte",
    "line": 43,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/profile/components/ProfileSummaryCard.svelte:54`  
  ```json
  {
    "file": "src/features/profile/components/ProfileSummaryCard.svelte",
    "line": 54,
    "tag": "<Item.Group",
    "classValue": "\"grid grid-cols-2 gap-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/profile/components/ProfileSummaryCard.svelte:56`  
  ```json
  {
    "file": "src/features/profile/components/ProfileSummaryCard.svelte",
    "line": 56,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionBasicInfoCard.svelte:56`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionBasicInfoCard.svelte",
    "line": 56,
    "tag": "<Button",
    "classValue": "\"h-auto w-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionBasicInfoRelatedSections.svelte:28`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionBasicInfoRelatedSections.svelte",
    "line": 28,
    "tag": "<Button",
    "classValue": "\"h-auto min-h-8 whitespace-normal px-2 py-1 text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionBasicInfoRelatedSections.svelte:41`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionBasicInfoRelatedSections.svelte",
    "line": 41,
    "tag": "<Button",
    "classValue": "\"h-auto min-h-8 whitespace-normal px-2 py-1 text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionCalendarDialog.svelte:37`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionCalendarDialog.svelte",
    "line": 37,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-3xl sm:max-w-3xl\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionCalendarDialog.svelte:79`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionCalendarDialog.svelte",
    "line": 79,
    "tag": "<Button",
    "classValue": "\"w-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionCalendarEventCard.svelte:14`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionCalendarEventCard.svelte",
    "line": 14,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionCalendarEventCard.svelte:26`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionCalendarEventCard.svelte",
    "line": 26,
    "tag": "<Item.Footer",
    "classValue": "\"block\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionCalendarEventCard.svelte:33`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionCalendarEventCard.svelte",
    "line": 33,
    "tag": "<Item.Group",
    "classValue": "\"mt-3 grid gap-2 sm:grid-cols-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionCalendarUnscheduledEvents.svelte:18`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionCalendarUnscheduledEvents.svelte",
    "line": 18,
    "tag": "<Item.Group",
    "classValue": "\"gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionCalendarUrlRow.svelte:20`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionCalendarUrlRow.svelte",
    "line": 20,
    "tag": "<InputGroup.Input",
    "classValue": "\"truncate\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionCalendarUrlRow.svelte:29`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionCalendarUrlRow.svelte",
    "line": 29,
    "tag": "<InputGroup.Button",
    "classValue": "\"whitespace-nowrap\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionCreateHomeworkDialog.svelte:39`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionCreateHomeworkDialog.svelte",
    "line": 39,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-2xl sm:max-w-2xl\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionCreateHomeworkDialog.svelte:50`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionCreateHomeworkDialog.svelte",
    "line": 50,
    "tag": "<ScrollArea",
    "classValue": "\"h-[min(64vh,36rem)]\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionCreateHomeworkFields.svelte:34`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionCreateHomeworkFields.svelte",
    "line": 34,
    "tag": "<Field.Group",
    "classValue": "\"gap-4 px-5 py-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionDetailMainContent.svelte:216`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionDetailMainContent.svelte",
    "line": 216,
    "tag": "<ScrollArea",
    "classValue": "\"min-w-0 min-h-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkAuditDialog.svelte:42`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkAuditDialog.svelte",
    "line": 42,
    "tag": "<Dialog.Content",
    "classValue": "\"!max-w-2xl sm:!max-w-2xl\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkAuditDialog.svelte:49`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkAuditDialog.svelte",
    "line": 49,
    "tag": "<ScrollArea",
    "classValue": "\"h-[min(72vh,42rem)]\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkAuditDialog.svelte:61`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkAuditDialog.svelte",
    "line": 61,
    "tag": "<Item.Content",
    "classValue": "\"min-w-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkAuditDialog.svelte:62`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkAuditDialog.svelte",
    "line": 62,
    "tag": "<Item.Title",
    "classValue": "\"line-clamp-none flex-wrap\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkAuditTrail.svelte:35`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkAuditTrail.svelte",
    "line": 35,
    "tag": "<Item.Description",
    "classValue": "\"line-clamp-none\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkCardsView.svelte:21`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkCardsView.svelte",
    "line": 21,
    "tag": "<Item.Root",
    "classValue": "\"items-start text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkCardsView.svelte:34`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkCardsView.svelte",
    "line": 34,
    "tag": "<Item.Description",
    "classValue": "\"line-clamp-3 whitespace-pre-wrap\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkCardsView.svelte:39`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkCardsView.svelte",
    "line": 39,
    "tag": "<Item.Actions",
    "classValue": "\"flex-wrap justify-end\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkDeleteDialog.svelte:30`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkDeleteDialog.svelte",
    "line": 30,
    "tag": "<AlertDialog.Content",
    "classValue": "\"max-w-md sm:max-w-md\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkDetailDialog.svelte:72`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkDetailDialog.svelte",
    "line": 72,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-5xl sm:max-w-5xl\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkDetailDialog.svelte:89`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkDetailDialog.svelte",
    "line": 89,
    "tag": "<ScrollArea",
    "classValue": "\"h-[min(70vh,44rem)]\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkDetailDialog.svelte:142`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkDetailDialog.svelte",
    "line": 142,
    "tag": "<Separator",
    "classValue": "\"hidden lg:block\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkDetailDialog.svelte:145`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkDetailDialog.svelte",
    "line": 145,
    "tag": "<Separator",
    "classValue": "\"mb-4 lg:hidden\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkEditForm.svelte:45`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkEditForm.svelte",
    "line": 45,
    "tag": "<Field.Group",
    "classValue": "\"gap-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkEditTimestampFields.svelte:25`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkEditTimestampFields.svelte",
    "line": 25,
    "tag": "<Field.Group",
    "classValue": "\"grid gap-3 sm:grid-cols-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkEditTimestampFields.svelte:38`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkEditTimestampFields.svelte",
    "line": 38,
    "tag": "<ButtonGroup.Root",
    "classValue": "\"ml-auto max-w-full flex-wrap justify-end\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkEditTimestampFields.svelte:66`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkEditTimestampFields.svelte",
    "line": 66,
    "tag": "<ButtonGroup.Root",
    "classValue": "\"ml-auto max-w-full flex-wrap justify-end\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkEditTimestampFields.svelte:102`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkEditTimestampFields.svelte",
    "line": 102,
    "tag": "<ButtonGroup.Root",
    "classValue": "\"ml-auto max-w-full flex-wrap justify-end\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkListView.svelte:32`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkListView.svelte",
    "line": 32,
    "tag": "<Button",
    "classValue": "\"h-auto whitespace-normal text-left\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkListView.svelte:53`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkListView.svelte",
    "line": 53,
    "tag": "<Table.Cell",
    "classValue": "\"p-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkListView.svelte:54`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkListView.svelte",
    "line": 54,
    "tag": "<Empty.Root",
    "classValue": "\"py-6\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkReadOnlySummary.svelte:17`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkReadOnlySummary.svelte",
    "line": 17,
    "tag": "<Item.Root",
    "classValue": "\"items-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkReadOnlySummary.svelte:31`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkReadOnlySummary.svelte",
    "line": 31,
    "tag": "<Item.Root",
    "classValue": "\"block\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkReadOnlySummary.svelte:35`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkReadOnlySummary.svelte",
    "line": 35,
    "tag": "<Item.Root",
    "classValue": "\"block\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkReadOnlySummary.svelte:39`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkReadOnlySummary.svelte",
    "line": 39,
    "tag": "<Item.Root",
    "classValue": "\"block\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkTagFields.svelte:18`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkTagFields.svelte",
    "line": 18,
    "tag": "<Field.Legend",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkTagFields.svelte:21`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkTagFields.svelte",
    "line": 21,
    "tag": "<Field.Group",
    "classValue": "\"flex-row flex-wrap gap-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkTagFields.svelte:22`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkTagFields.svelte",
    "line": 22,
    "tag": "<Field.Field",
    "classValue": "\"w-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkTagFields.svelte:28`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkTagFields.svelte",
    "line": 28,
    "tag": "<Field.Field",
    "classValue": "\"w-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkTimestampFields.svelte:23`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkTimestampFields.svelte",
    "line": 23,
    "tag": "<Field.Group",
    "classValue": "\"grid gap-3 sm:grid-cols-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkTimestampFields.svelte:36`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkTimestampFields.svelte",
    "line": 36,
    "tag": "<ButtonGroup.Root",
    "classValue": "\"ml-auto max-w-full flex-wrap justify-end\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkTimestampFields.svelte:64`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkTimestampFields.svelte",
    "line": 64,
    "tag": "<ButtonGroup.Root",
    "classValue": "\"ml-auto max-w-full flex-wrap justify-end\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionHomeworkTimestampFields.svelte:100`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionHomeworkTimestampFields.svelte",
    "line": 100,
    "tag": "<ButtonGroup.Root",
    "classValue": "\"ml-auto max-w-full flex-wrap justify-end\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionSubscribeDialog.svelte:33`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionSubscribeDialog.svelte",
    "line": 33,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-lg sm:max-w-lg\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/section-detail/components/SectionTeachersCard.svelte:35`  
  ```json
  {
    "file": "src/features/section-detail/components/SectionTeachersCard.svelte",
    "line": 35,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-20 p-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsAccountRow.svelte:25`  
  ```json
  {
    "file": "src/features/settings/components/SettingsAccountRow.svelte",
    "line": 25,
    "tag": "<Item.Content",
    "classValue": "\"min-w-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsAccountRow.svelte:27`  
  ```json
  {
    "file": "src/features/settings/components/SettingsAccountRow.svelte",
    "line": 27,
    "tag": "<Item.Description",
    "classValue": "\"truncate\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsAccountRow.svelte:31`  
  ```json
  {
    "file": "src/features/settings/components/SettingsAccountRow.svelte",
    "line": 31,
    "tag": "<Item.Actions",
    "classValue": "\"flex-wrap justify-end\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsAvatarPicker.svelte:22`  
  ```json
  {
    "file": "src/features/settings/components/SettingsAvatarPicker.svelte",
    "line": 22,
    "tag": "<Avatar.Root",
    "classValue": "\"size-20\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsAvatarPicker.svelte:33`  
  ```json
  {
    "file": "src/features/settings/components/SettingsAvatarPicker.svelte",
    "line": 33,
    "tag": "<Radio.Root",
    "classValue": "\"grid grid-cols-4 gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsAvatarPicker.svelte:42`  
  ```json
  {
    "file": "src/features/settings/components/SettingsAvatarPicker.svelte",
    "line": 42,
    "tag": "<Field.Label",
    "classValue": "\"cursor-pointer\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsAvatarPicker.svelte:43`  
  ```json
  {
    "file": "src/features/settings/components/SettingsAvatarPicker.svelte",
    "line": 43,
    "tag": "<Avatar.Root",
    "classValue": "\"size-12\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsContentTab.svelte:17`  
  ```json
  {
    "file": "src/features/settings/components/SettingsContentTab.svelte",
    "line": 17,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-5\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsContentTab.svelte:24`  
  ```json
  {
    "file": "src/features/settings/components/SettingsContentTab.svelte",
    "line": 24,
    "tag": "<Item.Group",
    "classValue": "\"grid gap-3 sm:grid-cols-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsDangerTab.svelte:29`  
  ```json
  {
    "file": "src/features/settings/components/SettingsDangerTab.svelte",
    "line": 29,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsDangerTab.svelte:30`  
  ```json
  {
    "file": "src/features/settings/components/SettingsDangerTab.svelte",
    "line": 30,
    "tag": "<Button",
    "classValue": "\"w-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsDangerTab.svelte:52`  
  ```json
  {
    "file": "src/features/settings/components/SettingsDangerTab.svelte",
    "line": 52,
    "tag": "<AlertDialog.Content",
    "classValue": "\"max-w-md sm:max-w-md\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsDangerTab.svelte:81`  
  ```json
  {
    "file": "src/features/settings/components/SettingsDangerTab.svelte",
    "line": 81,
    "tag": "<AlertDialog.Footer",
    "classValue": "\"px-0 pb-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsDisconnectAccountDialog.svelte:28`  
  ```json
  {
    "file": "src/features/settings/components/SettingsDisconnectAccountDialog.svelte",
    "line": 28,
    "tag": "<AlertDialog.Content",
    "classValue": "\"max-w-md sm:max-w-md\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsPageController.svelte:106`  
  ```json
  {
    "file": "src/features/settings/components/SettingsPageController.svelte",
    "line": 106,
    "tag": "<Item.Group",
    "classValue": "\"grid gap-2 sm:grid-cols-2 xl:grid-cols-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsPageController.svelte:119`  
  ```json
  {
    "file": "src/features/settings/components/SettingsPageController.svelte",
    "line": 119,
    "tag": "<Item.Media",
    "classValue": "{item.id === \"danger\" ? \"text-destructive\" : undefined}",
    "styleValue": null,
    "decision": "review",
    "action": "inspect dynamic expression; convert styling tokens to variants or theme tokens",
    "reason": "dynamic class expression may contain styling overrides: text-destructive"
  }
  ```

- `src/features/settings/components/SettingsProfileTab.svelte:31`  
  ```json
  {
    "file": "src/features/settings/components/SettingsProfileTab.svelte",
    "line": 31,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-5\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsProfileTab.svelte:42`  
  ```json
  {
    "file": "src/features/settings/components/SettingsProfileTab.svelte",
    "line": 42,
    "tag": "<Field.Group",
    "classValue": "\"grid gap-4 md:grid-cols-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/settings/components/SettingsProfileTab.svelte:82`  
  ```json
  {
    "file": "src/features/settings/components/SettingsProfileTab.svelte",
    "line": 82,
    "tag": "<Button",
    "classValue": "\"w-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeBulkImportDialog.svelte:37`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeBulkImportDialog.svelte",
    "line": 37,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-lg sm:max-w-lg\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeBulkImportDialog.svelte:45`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeBulkImportDialog.svelte",
    "line": 45,
    "tag": "<Field.Group",
    "classValue": "\"gap-4 px-5 py-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeBulkImportDialog.svelte:60`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeBulkImportDialog.svelte",
    "line": 60,
    "tag": "<NativeSelect.Root",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeConfirmImportDialog.svelte:41`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeConfirmImportDialog.svelte",
    "line": 41,
    "tag": "<Dialog.Content",
    "classValue": "\"max-w-2xl sm:max-w-2xl\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeConfirmImportDialog.svelte:54`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeConfirmImportDialog.svelte",
    "line": 54,
    "tag": "<ScrollArea",
    "classValue": "\"h-[min(60vh,24rem)]\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeConfirmImportDialog.svelte:58`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeConfirmImportDialog.svelte",
    "line": 58,
    "tag": "<Field.Legend",
    "classValue": "\"sr-only\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeConfirmImportDialog.svelte:61`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeConfirmImportDialog.svelte",
    "line": 61,
    "tag": "<Field.Group",
    "classValue": "\"gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeConfirmImportDialog.svelte:76`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeConfirmImportDialog.svelte",
    "line": 76,
    "tag": "<Field.Label",
    "classValue": "\"cursor-pointer\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeConfirmImportDialog.svelte:93`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeConfirmImportDialog.svelte",
    "line": 93,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-20 p-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeNextStepsCard.svelte:12`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeNextStepsCard.svelte",
    "line": 12,
    "tag": "<Card.Root",
    "classValue": "\"lg:sticky lg:top-20 lg:h-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeNextStepsCard.svelte:19`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeNextStepsCard.svelte",
    "line": 19,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeNextStepsCard.svelte:25`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeNextStepsCard.svelte",
    "line": 25,
    "tag": "<Button",
    "classValue": "\"justify-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeNextStepsCard.svelte:26`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeNextStepsCard.svelte",
    "line": 26,
    "tag": "<Button",
    "classValue": "\"justify-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeNextStepsCard.svelte:27`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeNextStepsCard.svelte",
    "line": 27,
    "tag": "<Button",
    "classValue": "\"justify-start\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeProfileForm.svelte:45`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeProfileForm.svelte",
    "line": 45,
    "tag": "<Card.Header",
    "classValue": "\"items-center text-center\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeProfileForm.svelte:46`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeProfileForm.svelte",
    "line": 46,
    "tag": "<Badge",
    "classValue": "\"w-fit\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeProfileForm.svelte:51`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeProfileForm.svelte",
    "line": 51,
    "tag": "<Card.Content",
    "classValue": "\"grid gap-6\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeProfileForm.svelte:64`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeProfileForm.svelte",
    "line": 64,
    "tag": "<Avatar.Root",
    "classValue": "\"size-20\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeProfileForm.svelte:69`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeProfileForm.svelte",
    "line": 69,
    "tag": "<Radio.Root",
    "classValue": "\"grid grid-cols-4 gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeProfileForm.svelte:79`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeProfileForm.svelte",
    "line": 79,
    "tag": "<Avatar.Root",
    "classValue": "\"size-12\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeProfileForm.svelte:100`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeProfileForm.svelte",
    "line": 100,
    "tag": "<Field.Group",
    "classValue": "\"gap-4\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/features/welcome/components/WelcomeProfileForm.svelte:113`  
  ```json
  {
    "file": "src/features/welcome/components/WelcomeProfileForm.svelte",
    "line": 113,
    "tag": "<Button",
    "classValue": "\"w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/DateTimePicker.svelte:72`  
  ```json
  {
    "file": "src/lib/components/DateTimePicker.svelte",
    "line": 72,
    "tag": "<InputGroup.Root",
    "classValue": "{cn(\"min-w-0\", className)}",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/DateTimePicker.svelte:104`  
  ```json
  {
    "file": "src/lib/components/DateTimePicker.svelte",
    "line": 104,
    "tag": "<Popover.Content",
    "classValue": "\"w-auto overflow-hidden p-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/DetailPinnedSummary.svelte:48`  
  ```json
  {
    "file": "src/lib/components/DetailPinnedSummary.svelte",
    "line": 48,
    "tag": "<Badge",
    "classValue": "\"max-w-52 truncate\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/DetailSectionNav.svelte:19`  
  ```json
  {
    "file": "src/lib/components/DetailSectionNav.svelte",
    "line": 19,
    "tag": "<Sidebar.Root",
    "classValue": "\"w-full border-sidebar-border border-b lg:w-(--sidebar-width) lg:border-e lg:border-b-0\"",
    "styleValue": null,
    "decision": "convert",
    "action": "keep layout tokens (w-full, w-(--sidebar-width)); convert styling tokens: border-sidebar-border, border-b, border-e, border-b-0",
    "reason": "mixes layout and styling tokens"
  }
  ```

- `src/lib/components/MarkdownEditor.svelte:75`  
  ```json
  {
    "file": "src/lib/components/MarkdownEditor.svelte",
    "line": 75,
    "tag": "<Tabs.Root",
    "classValue": "\"gap-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/MarkdownEditor.svelte:85`  
  ```json
  {
    "file": "src/lib/components/MarkdownEditor.svelte",
    "line": 85,
    "tag": "<Tabs.Content",
    "classValue": "\"m-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/MarkdownEditor.svelte:90`  
  ```json
  {
    "file": "src/lib/components/MarkdownEditor.svelte",
    "line": 90,
    "tag": "<InputGroup.Root",
    "classValue": "\"h-auto min-h-32\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/MarkdownEditor.svelte:91`  
  ```json
  {
    "file": "src/lib/components/MarkdownEditor.svelte",
    "line": 91,
    "tag": "<InputGroup.Textarea",
    "classValue": "\"min-h-32 resize-y\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/MarkdownEditor.svelte:104`  
  ```json
  {
    "file": "src/lib/components/MarkdownEditor.svelte",
    "line": 104,
    "tag": "<Tabs.Content",
    "classValue": "\"m-0 min-h-32 p-3\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/MarkdownPreview.svelte:25`  
  ```json
  {
    "file": "src/lib/components/MarkdownPreview.svelte",
    "line": 25,
    "tag": "<Empty.Root",
    "classValue": "\"min-h-24\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/PageHeader.svelte:43`  
  ```json
  {
    "file": "src/lib/components/PageHeader.svelte",
    "line": 43,
    "tag": "<Badge",
    "classValue": "\"mb-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/PageHeaderMeta.svelte:12`  
  ```json
  {
    "file": "src/lib/components/PageHeaderMeta.svelte",
    "line": 12,
    "tag": "<Item.Root",
    "classValue": "{cn(\"w-auto min-w-40 items-start\", className)}",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/calendar/CalendarEventChip.svelte:40`  
  ```json
  {
    "file": "src/lib/components/calendar/CalendarEventChip.svelte",
    "line": 40,
    "tag": "<Item.Root",
    "classValue": "{cn(\n          \"min-w-0 no-underline\",\n          tone === \"warning\"\n            ? \"border-warning/25 bg-warning/10 hover:border-warning/45 hover:bg-warning/15\"\n            : tone === \"success\"\n              ? \"border-success/25 bg-success/10 hover:border-success/45 hover:bg-success/15\"\n              : tone === \"info\"\n                ? \"border-info/25 bg-info/10 hover:border-info/45 hover:bg-info/15\"\n                : tone === \"error\"\n                  ? \"border-destructive/25 bg-destructive/10 hover:border-destructive/45 hover:bg-destructive/15\"\n                  : tone === \"neutral\"\n                    ? \"border-border bg-background hover:border-primary/45 hover:bg-muted/50\"\n                    : \"border-primary/25 bg-primary/10 hover:border-primary/45 hover:bg-primary/15\",\n          done ? \"grayscale opacity-60\" : undefined,\n        )}",
    "styleValue": null,
    "decision": "review",
    "action": "inspect dynamic expression; convert styling tokens to variants or theme tokens",
    "reason": "dynamic class expression may contain styling overrides: no-underline, border-warning/25, bg-warning/10, border-warning/45, bg-warning/15, border-success/25, bg-success/10, border-success/45, bg-success/15, border-info/25, bg-info/10, border-info/45, bg-info/15, border-destructive/25, bg-destructive/10, border-destructive/45, bg-destructive/15, border-border, bg-background, border-primary/45, bg-muted/50, border-primary/25, bg-primary/10, bg-primary/15, grayscale, opacity-60"
  }
  ```

- `src/lib/components/calendar/CalendarEventChip.svelte:61`  
  ```json
  {
    "file": "src/lib/components/calendar/CalendarEventChip.svelte",
    "line": 61,
    "tag": "<Item.Content",
    "classValue": "\"gap-0\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/calendar/CalendarEventChip.svelte:62`  
  ```json
  {
    "file": "src/lib/components/calendar/CalendarEventChip.svelte",
    "line": 62,
    "tag": "<Item.Title",
    "classValue": "\"max-w-full\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/calendar/CalendarEventChip.svelte:64`  
  ```json
  {
    "file": "src/lib/components/calendar/CalendarEventChip.svelte",
    "line": 64,
    "tag": "<Item.Description",
    "classValue": "\"max-w-full line-clamp-1\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/calendar/CalendarEventChip.svelte:67`  
  ```json
  {
    "file": "src/lib/components/calendar/CalendarEventChip.svelte",
    "line": 67,
    "tag": "<Item.Description",
    "classValue": "\"max-w-full line-clamp-1\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/calendar/CalendarEventChip.svelte:70`  
  ```json
  {
    "file": "src/lib/components/calendar/CalendarEventChip.svelte",
    "line": 70,
    "tag": "<Item.Description",
    "classValue": "\"max-w-full line-clamp-1\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/calendar/CalendarGridDayCell.svelte:35`  
  ```json
  {
    "file": "src/lib/components/calendar/CalendarGridDayCell.svelte",
    "line": 35,
    "tag": "<Badge",
    "classValue": "\"h-5 min-w-5 px-1\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/calendar/CalendarWeekStrip.svelte:50`  
  ```json
  {
    "file": "src/lib/components/calendar/CalendarWeekStrip.svelte",
    "line": 50,
    "tag": "<Badge",
    "classValue": "\"h-5 min-w-5 px-1\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/shell/AppShell.svelte:274`  
  ```json
  {
    "file": "src/lib/components/shell/AppShell.svelte",
    "line": 274,
    "tag": "<Sidebar.Provider",
    "classValue": "\"min-h-screen lg:h-screen lg:min-h-0 lg:overflow-hidden\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/shell/AppShell.svelte:287`  
  ```json
  {
    "file": "src/lib/components/shell/AppShell.svelte",
    "line": 287,
    "tag": "<Sidebar.Inset",
    "classValue": "\"relative flex w-full min-w-0 flex-1 flex-col lg:h-screen lg:min-h-0 lg:overflow-hidden\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/shell/AppSidebar.svelte:41`  
  ```json
  {
    "file": "src/lib/components/shell/AppSidebar.svelte",
    "line": 41,
    "tag": "<Collapsible.Root",
    "classValue": "\"group/collapsible\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/shell/AppTopbar.svelte:64`  
  ```json
  {
    "file": "src/lib/components/shell/AppTopbar.svelte",
    "line": 64,
    "tag": "<DropdownMenu.Content",
    "classValue": "\"w-40\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/shell/AppTopbar.svelte:103`  
  ```json
  {
    "file": "src/lib/components/shell/AppTopbar.svelte",
    "line": 103,
    "tag": "<DropdownMenu.Content",
    "classValue": "\"w-44\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/shell/AppUserMenu.svelte:21`  
  ```json
  {
    "file": "src/lib/components/shell/AppUserMenu.svelte",
    "line": 21,
    "tag": "<Button",
    "classValue": "\"overflow-hidden\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/shell/AppUserMenu.svelte:28`  
  ```json
  {
    "file": "src/lib/components/shell/AppUserMenu.svelte",
    "line": 28,
    "tag": "<Avatar.Root",
    "classValue": "\"size-7\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/lib/components/shell/AppUserMenu.svelte:40`  
  ```json
  {
    "file": "src/lib/components/shell/AppUserMenu.svelte",
    "line": 40,
    "tag": "<DropdownMenu.Content",
    "classValue": "\"w-44\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/routes/_components/LegalDocument.svelte:13`  
  ```json
  {
    "file": "src/routes/_components/LegalDocument.svelte",
    "line": 13,
    "tag": "<Card.Root",
    "classValue": "\"mx-auto w-full max-w-3xl\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/routes/_components/LegalDocument.svelte:14`  
  ```json
  {
    "file": "src/routes/_components/LegalDocument.svelte",
    "line": 14,
    "tag": "<Card.Content",
    "classValue": "\"px-6 md:px-8\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/routes/_components/RouteErrorCard.svelte:47`  
  ```json
  {
    "file": "src/routes/_components/RouteErrorCard.svelte",
    "line": 47,
    "tag": "<Card.Root",
    "classValue": "\"w-full max-w-md\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/routes/_components/RouteErrorCard.svelte:48`  
  ```json
  {
    "file": "src/routes/_components/RouteErrorCard.svelte",
    "line": 48,
    "tag": "<Card.Header",
    "classValue": "\"text-center\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/routes/_components/RouteErrorCard.svelte:55`  
  ```json
  {
    "file": "src/routes/_components/RouteErrorCard.svelte",
    "line": 55,
    "tag": "<Card.Content",
    "classValue": "\"flex flex-wrap justify-center gap-2\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/routes/error/+page.svelte:17`  
  ```json
  {
    "file": "src/routes/error/+page.svelte",
    "line": 17,
    "tag": "<Card.Root",
    "classValue": "\"w-full max-w-md\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/routes/error/+page.svelte:18`  
  ```json
  {
    "file": "src/routes/error/+page.svelte",
    "line": 18,
    "tag": "<Card.Header",
    "classValue": "\"text-center\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```

- `src/routes/error/+page.svelte:24`  
  ```json
  {
    "file": "src/routes/error/+page.svelte",
    "line": 24,
    "tag": "<Card.Content",
    "classValue": "\"grid justify-items-center gap-4 text-center\"",
    "styleValue": null,
    "decision": "keep",
    "action": "no styling overrides present",
    "reason": "contains only layout tokens"
  }
  ```
