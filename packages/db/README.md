# @hotel100/db

Gate D database invariant tests using in-memory [PGlite](https://github.com/electric-sql/pglite).

Applies SQL from `supabase/migrations/` in filename order.

```bash
pnpm --filter @hotel100/db test
```

Production Supabase credentials remain unresolved configuration inputs — never invent them.
