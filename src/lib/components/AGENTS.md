# src/lib/components/

Shared UI primitives and layout components.

## Rules

- Client navigation follows `docs/policies/rendering-and-cache.yaml`: `src/app.html` sets
  `data-sveltekit-preload-code="hover"` and `data-sveltekit-preload-data="tap"`.
  Hover may warm route code only; `__data.json` preload waits for tap/click
  intent. `DetailSectionNav` links use `data-sveltekit-preload-data="off"`
  because tab switches are handled client-side or should not prefetch sibling
  tabs on pointer hover.
- Keep components feature-neutral: no route data loading, mutations, or
  feature-owned state machines.
- Feature-specific UI stays under `src/features/<feature>/components`.
- Prefer the local UI wrapper components here over direct primitive-library
  usage in feature code.
- Content pages copy `CollectionPage`. List pages fill title, actions, an
  optional note, toolbar, results, and pagination. Set `panel={false}` when
  the body is several `Panel` sections. Set `layout="detail"` and fill `aside`
  for a two-column detail page. Do not wrap a page in a card.
- Keep icons in one system. Add a local icon only when the library icon cannot
  be used directly.
