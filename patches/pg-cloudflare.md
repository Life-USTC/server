# pg-cloudflare 1.4.1

`pg-cloudflare@1.4.1.patch` applies the socket lifecycle fix from
[node-postgres #3806](https://github.com/brianc/node-postgres/pull/3806), commit
`572b3b4fc00236fce2423f6f31d9de3fd7dccdce`.

workerd rejects a pending read when the socket closes. The patch stops listening
after local `end()` or an already reported peer close, while preserving read
errors from active sockets. Without it, the pg upgrade reports spurious pool
errors and prevents private Workers from stopping within their existing timeout.

Bun applies the version-pinned patch during frozen installs. The patch includes
the upstream TypeScript source and its generated JavaScript, declarations and
source map, compiled with TypeScript 6.0.3 and the upstream compiler options.
`tests/unit/lib/db/pg-cloudflare-lifecycle.test.ts` covers both close paths and
active read failures; real Worker request tests verify application teardown.

Remove the patch and its `patchedDependencies` entry when a released version
contains this fix and passes the same lifecycle and Worker tests.
