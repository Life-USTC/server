# src/lib/components/

Shared UI primitives and layout components.

## Rules

- Keep components feature-neutral: no route data loading, mutations, or feature-owned state machines.
- Feature-specific UI stays under `src/features/<feature>/components`.
- Prefer the local UI wrapper components here over direct primitive-library usage in feature code.
- Keep icons in one system. Add a local icon only when the library icon cannot be used directly.
