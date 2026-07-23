# GraphQL schema evolution policy

The canonical SDL snapshot and breaking-change gate remain authoritative. CI
also blocks dangerous changes that can alter existing client behavior:

- enum value and union-member additions;
- newly implemented interfaces;
- argument default changes;
- input-object field default additions, removals, and changes.

Optional argument and optional input-field additions remain additive-safe. They
are allowed by the compatibility gate but remain visible in the canonical SDL
diff for normal review. A behavior-changing default must be introduced as an
explicitly reviewed schema change rather than hidden behind that exception.

An intentionally breaking schema migration must use a Conventional Commit
breaking marker in the pull-request title, such as `feat!:` or
`feat(graphql)!:`. CI still verifies that the canonical SDL snapshot matches
the implementation, but skips comparison with the previous schema only for
that explicitly marked pull request. Unmarked pull requests remain subject to
the full compatibility gate.
