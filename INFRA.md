# INFRA.md — Cloudflare setup (phased)

Companion to [PLAN.md](PLAN.md). This file is the **user's runbook** for the Cloudflare dashboard / DNS work. It is structured around the same four phases as PLAN.md; each phase lists the exact handoff expected back to the agent.

## Context

Migrating hosting from GitHub Pages to Cloudflare Pages so we can run a Pages Functions worker backed by Workers KV alongside the static Vue bundle. Worker stores scenario state keyed by GUID with a 90-day TTL that refreshes on read. See [PLAN.md](PLAN.md) § Context for product rationale.

Downtime during cutover is acceptable (no live users yet). Until Phase C, production `takehomeviz.com` keeps serving the existing GitHub Pages bundle — Phase B is fully reversible.

---

## Orchestration overview

| Phase | Owner | Blocks on | Unblocks |
|---|---|---|---|
| A | User | — | Agent Phase B |
| B | Agent | KV IDs from A | User Phase C |
| C | User | Smoke test of `*.pages.dev` from B | Agent Phase D |
| D | Agent | Cutover done signal from C | — |

---

# Phase A — Infra prereqs (user)

Goal: stand up the Cloudflare Pages project + KV namespaces, **without** touching `takehomeviz.com` DNS. The site continues serving from GitHub Pages throughout. The new Pages project will live at something like `takehomeviz.pages.dev`.

## A.1 Pages project

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → select `TakeHomeViz`.
2. Build settings:
   - Framework preset: `None`
   - Build command: `pnpm install --frozen-lockfile && pnpm build`
   - Build output directory: `packages/web/dist`
   - Root directory: *(blank — monorepo root)*
3. Environment variables (Production **and** Preview):
   - `NODE_VERSION=24`
   - `VITE_BASE=/` (optional; matches existing default)
4. Corepack: confirm root `package.json` has a `"packageManager"` field. If the first build fails on "pnpm not found", also set `COREPACK_ENABLE_STRICT=0` and retry.
5. Wait for the first build of `main` to succeed. Visit the `*.pages.dev` URL — it should render the current app (no worker yet; KV not yet wired).

## A.2 Workers KV namespaces

1. **Workers & Pages → KV → Create namespace** twice:
   - `takehomeviz-state` (production)
   - `takehomeviz-state-preview` (preview)
2. Copy both namespace IDs.
3. Pages project → **Settings → Functions → KV namespace bindings**:
   - Variable name: `STATE_KV`
   - Production environment → `takehomeviz-state`
   - Preview environment → `takehomeviz-state-preview`

## A.3 🤝 Handoff to agent

Post the following into chat:

- `PROD_KV_ID = <...>`
- `PREVIEW_KV_ID = <...>`
- `PAGES_URL = https://<project>.pages.dev` (from the Pages dashboard)
- Confirmation that the first build succeeded, and whether `COREPACK_ENABLE_STRICT=0` was needed.

Agent then starts **Phase B** ([PLAN.md](PLAN.md) Phase B).

---

# Phase B — Code PR (agent)

User does nothing here except review the PR. Once merged, Pages auto-builds and deploys the worker to `*.pages.dev`. Production (`takehomeviz.com`) is unaffected.

See [PLAN.md](PLAN.md) Phase B for the full code plan.

## B handoff back to user

Agent will post into chat:

- PR URL (merged)
- The `*.pages.dev` URL and a checklist of smoke tests from PLAN §B.9 (auto-persist, share + fork, bookmark, download/upload).

User runs those smoke tests against `*.pages.dev` before starting Phase C.

---

# Phase C — Cutover (user)

Goal: flip `takehomeviz.com` from GitHub Pages to Cloudflare Pages. Agent is idle.

## C.1 Rate limiting rule

Cloudflare zone (`takehomeviz.com`) → **Security → WAF → Rate limiting rules**:

- Name: `api-state-write-limit`
- Match: URI path starts with `/api/state` **AND** method in (`POST`, `PUT`)
- Characteristic: client IP
- Rate: **60 requests / 1 minute**
- Action: Block for 1 minute, response `429`

Free plan includes one rate-limiting rule. The 100KB payload cap in the worker covers remaining write-abuse surface. If we ever want a companion GET-only rule, that needs Pro.

## C.2 Custom domain on Pages

**If the domain is already on Cloudflare's nameservers:**
- Pages project → **Custom domains** → Add `takehomeviz.com` and `www.takehomeviz.com`.
- Cloudflare provisions the CNAME and SSL automatically. GitHub Pages stops resolving within minutes.

**If the domain is registered elsewhere:**
- Either transfer to Cloudflare Registrar, or switch the registrar's nameservers to Cloudflare's assigned pair.
- Allow up to 24h for nameserver propagation, then same as above.

## C.3 Disable GitHub Pages

GitHub repo → **Settings → Pages → Source: None**.

*(The workflow file [.github/workflows/deploy.yml](.github/workflows/deploy.yml) and the `CNAME` file in the bundle are deleted by the agent in Phase D, not here.)*

## C.4 Post-cutover sanity check

- `curl -I https://takehomeviz.com` returns Cloudflare server headers (not GitHub).
- Any `?id=<X>` URL created during Phase B smoke-testing still loads (KV namespace bindings preserved).
- A fresh edit persists and reloads cleanly.

## C.5 🤝 Handoff to agent

Post into chat: "Phase C done — cutover complete, `takehomeviz.com` on Pages."

Agent then starts **Phase D** ([PLAN.md](PLAN.md) Phase D).

---

# Phase D — Cleanup PR (agent)

User reviews and merges. Agent deletes:

- [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
- `packages/web/public/CNAME` (or `packages/web/dist/CNAME` if the source lives there)

No runtime impact.

---

# Observability (apply anytime post-cutover)

- Pages project → **Functions → Logs**: live tail is free. Persistent retention requires Workers Paid.
- KV namespace → **Metrics**: watch daily write ops. Free plan = 1000 writes/day. With 1s debounce + lazy-mint, one active editor ≈ 60–100 writes/hour; ~10 concurrent active editors before hitting the free ceiling. Paid plan: $5/mo base.

# Out of scope for this migration (flag for future)

- **Durable Objects / strong consistency.** Workers KV is eventually consistent (~60s). Fine for single-user editing; matters only for multi-user collab.
- **Turnstile.** Add only if rate limit + payload cap prove insufficient.
- **`DELETE /api/state/:id`.** 90-day TTL is the forget mechanism for v1. Trivial to add later.
- **Schema versioning.** Breaking `urlStateSchema` changes become a migration problem once records are in KV — don't remove/rename fields without a migration plan (version the stored value, or migrate in the GET handler on read).
