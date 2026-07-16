# IDEAS.md — candidates for after v1.0

Not commitments. Two weeks of real use decides what earns a place
(SPEC.md rule). This file is the curated backlog; the raw inbox is the
in-app idea box (`ideas` table). At scoping time: `select author, body,
created_at from ideas order by created_at;` in the SQL editor, paste
the output into a session, and entries get triaged into this file.

- **Multi-currency entry** (raised 2026-07-16, travel use case). Stopgap
  in v1.0: log the SGD amount the card was charged, put the foreign
  amount in the note. Hard part if built: dashboard sums across
  currencies need an exchange-rate policy.
- **Ledger filtering / search** (raised 2026-07-16, re-raised same day:
  filter by person and by category). Three possible shapes, undecided —
  usage picks: (a) ledger filter by person, (b) ledger filter by
  category, (c) no filter at all but a per-person split line on the
  dashboard ("Shawn S$x · Claire S$y this month"), if the real question
  is "who spent what" rather than "find that entry". Dashboard covers
  category aggregates already; filters matter once the ledger is long.
- **In-app category manager** (deferred 2026-07-16). Add/rename/delete
  from inside the app so Claire can edit too. v1.0 stopgap: Supabase
  Table Editor. Builds the case if category edits turn out frequent.
