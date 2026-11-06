# Stable contextual navigation

Before is main `1a0a1abf` (including #1481). After uses the actual AppSidebar, shared Sidebar provider, navigation builders and product stylesheet. Both render identical synthetic organizer/settings data at DPR 1 in Chromium 153. The temporary main body and role controls are fixture content; account footer content is omitted in both. No real account or database was used.

| View                                                 | Before                              | After                             |
| ---------------------------------------------------- | ----------------------------------- | --------------------------------- |
| Anonymous organizer, English, 1280 × 900             | [Before](before-organizer-1280.png) | [After](after-organizer-1280.png) |
| Signed-in role fixture, settings, English, 390 × 900 | [Before](before-settings-390.png)   | [After](after-settings-390.png)   |

The old contexts remove Courses, Campus and Apps. After retains the same role-filtered primary groups and nests the local activity/settings destinations beneath their owner. The current organizer has one `aria-current=page` leaf, with both Second Classroom and Organizers marked as ancestors. Its long name wraps fully instead of clipping to one line. Root and parent controls remain reachable.

Restoring the full tree initially put the phone's Danger link below the viewport. The final local current-link action brings it into the sidebar's own scroll region (855–883px in this fixture) without replacing the navigation tree. Compact-to-expanded desktop navigation also reveals it (814–842px). The action responds to active-link changes/mounts rather than all badge/count updates, so background count refreshes do not force the reader back to the current link.

Four matched renderings had zero page errors, zero external requests and no horizontal document overflow. Further component interaction checks retained a document marker across the fixture's local course navigation/back, preserved Apps collapse after reload, identified Activities in compact mode, restored focus on Escape, and removed private destinations on a simulated signed-out role before restoring them on sign-in. Stored preferences contained static group IDs and booleans only.

All non-loopback browser requests were blocked. Navigation is a small same-document fixture using History API, not SvelteKit route execution. Role changes are props, not authentication. These observations establish actual component layout/behavior; they do not establish production routing, OAuth, database authorization, real private API recovery or account-footer geometry. Current-head CI must cover the existing owned route journeys before merge.

The fixture, generated measurements and diagnostic scripts are not shipped. Existing tests are updated for the shared tree; no test case, dependency, configuration layer or check framework was added. Independent source/visual review completed; the existing 22 navigation unit cases, specification validation (50 documents / 1,069 requirements), seven-file Biome check and both affected Svelte compilers pass.
