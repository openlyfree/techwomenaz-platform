# tests/quality — tw-review reproducer suite

Focused failing-test reproducers written by the quality review (owner: tw-review). These are
regression guards for defects found during the 2026-11-21 review; production fixes belong to the
respective file owners, not this directory.

Run (JSX needs the react plugin, hence the dedicated config):

```sh
npx vitest run --config tests/quality/vitest.config.ts
```

- `trpc-wire.test.ts` — proves `lib/api.ts` speaks the installed tRPC v11 wire protocol (query
  `?input=` encoding, POST mutation bodies, envelope unwrap) against a real `fetchRequestHandler`.
- `content-ai.test.ts` — rejects duplicate section ids in CMS saves and in untrusted Workers-AI
  JSON before they reach id-based editing or React keys.
- `public-renderer.test.ts` — requires at least one `<h1>` on any published page shape, including
  a mission-only document (`/about` with a fresh database).

RED evidence (11:47 MST): duplicate-id tests and the `<h1>` test failed against the checkout at
that time; GREEN evidence (11:53 MST) after owner fixes landed. See
`docs/review/2026-11-21-quality-review.md` for the full report.
