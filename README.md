# Life@USTC Server

The Life@USTC app and API. Web users, CLI, Bot, iOS, and MCP agents all talk to
this service.

Production: [https://life-ustc.tiankaima.dev](https://life-ustc.tiankaima.dev)

## Product

| Domain | What users can do |
|--------|-------------------|
| **Catalog** | Search courses / sections / teachers; semester schedules and exams; bus timetable and map; young events (第二课堂); campus links; weather; global search |
| **News** | Public publication list and detail (`/news`); REST ingestion for crawlers |
| **Workspace** | Overview and calendar; todos; homework completion; exams; section subscriptions (including import); iCal export; link pins; uploads |
| **Community** | Public profiles; comments / reactions; descriptions; shared section homework |
| **Account** | USTC OAuth / Passkey sign-in; profile and locale; linked accounts and authorizations |
| **Admin** | Users and suspensions; content moderation; OAuth clients; bus data |

Workspace Web tabs: `/workspace/{overview,calendar,homeworks,todos,exams,subscriptions}`
(plus subscription sub-routes). Schedules / uploads are mostly API and other
clients — not always a dedicated tab. Catalog also includes
`/catalog/young-events` and `/catalog/weather`.

## Clients / APIs

Web, REST, GraphQL, and MCP share one naming tree
([docs/interface-hierarchy.md](./docs/interface-hierarchy.md)):

- **Web** — SvelteKit (public catalog + signed-in workspace + admin)
- **REST** — `/api/catalog|workspace|community|account|admin|…` (OpenAPI at `/api-docs`)
- **GraphQL** — `/api/graphql` (`catalog` / `workspace` / `community` / `account`)
- **MCP** — `/api/mcp` (tools named like the contract ids)
- **OAuth** — authorize / device flows for CLI, Bot, and third parties

Contracts: [docs/contracts/](./docs/contracts/). Doc map: [docs/index.md](./docs/index.md).

## Contributors

- Layout and local checks → [AGENTS.md](./AGENTS.md)
- How to split a change and which tests to add →
  [`.agents/skills/life-ustc-implement`](./.agents/skills/life-ustc-implement/SKILL.md)
- Public SSR and cache (product-level) → [docs/rendering-and-cache.md](./docs/rendering-and-cache.md)
- Commit / PR / CI / review / merge → global agent skills (not in this repo)

Production monitoring and deploy runbooks are kept out of the public tree.
