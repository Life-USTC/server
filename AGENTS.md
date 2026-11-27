# Life@USTC Server

- Setup: [README](README.md). Contribution workflow: [CONTRIBUTING](CONTRIBUTING.md).
- Specifications: [docs/index.md](docs/index.md);
  inspect a feature with `bun run specs:show <feature-id>` and follow its `policy_refs`.
- Testing: [test runtime and fixtures](docs/test-runtime.md).
- Business code: `src/features/<domain>/server`.

- Before using ui-sdk, follow the ui-sdk skill if installed and read
  `node_modules/@ui-sdk/svelte/docs/llms.txt`. To build a new component,
  search `node_modules/@ui-sdk/svelte/docs/core.md` by heading and read
  `node_modules/@ui-sdk/svelte/docs/rendering.md`.
