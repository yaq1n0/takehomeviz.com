# PLAN.md — Code changes (phased)

Companion to [INFRA.md](INFRA.md). This file is the **agent's execution script**. It is structured as four phases separated by hard stop points. An agent following this file top-to-bottom MUST halt at every `🛑 STOP` marker and wait for the user to confirm the corresponding infra step before proceeding.

## Context

Today all scenario state lives in the URL hash as an lz-string-compressed JSON blob (`#s=<blob>`). Typical 3-scenario URLs are ~500–800 bytes but can grow past 2KB, producing links people are reluctant to share. Deployed to GitHub Pages at takehomeviz.com.

Goal: short opaque URLs (`?id=<guid>`) resolving to state in Cloudflare Workers KV, 90-day TTL refreshed on read.

Three distinct flows for a GUID in the URL:

1. **Your own URL (auto-persist)** — every edit debounce-writes to KV under the same GUID. Users bookmark/persist their work by keeping the URL. Copying it to another tab/device continues editing the same record.
2. **Explicit Share** — the Share button creates a *new* GUID containing a snapshot copy. Clipboard receives the snapshot URL. The sharer's working URL is untouched.
3. **Opening a snapshot** — viewing is fine; first edit forks into yet another new GUID, leaving the snapshot pristine.

To tell (1) from (3) the server marks snapshot records with an `isSnapshot` flag. Records without the flag edit in place; records with it fork on first edit.

User-confirmed decisions:
- **Fork-on-write** for snapshots only (not for auto-persist records).
- **Lazy mint** on first edit: no-id visitors see example data and don't touch KV until they change something.
- **No legacy `#s=` support** — greenfield pre-launch; delete the old encoder.
- **Abuse controls**: zone-level per-IP rate limit + server-side 100KB payload cap.
- **Downtime is acceptable** during cutover; no live users yet.

---

## Orchestration overview

| Phase | Owner | Output | Gate |
|---|---|---|---|
| A. Infra prereqs | User | Pages project + 2 KV namespaces exist | KV namespace IDs handed to agent |
| B. Code PR | Agent | PR merged; worker live at `*.pages.dev` | User smoke-tests on `*.pages.dev` |
| C. Cutover | User | Rate limit rule + custom domain on Pages; GitHub Pages disabled | User signals cutover complete |
| D. Cleanup PR | Agent | `deploy.yml` + CNAME deleted | — |

Invariant: until Phase C, production traffic on `takehomeviz.com` continues to hit GitHub Pages. Phase B is fully reversible — a broken worker doesn't affect users.

---

# 🛑 STOP 0 — Before starting Phase B

Agent: do not begin any code changes until the user has completed **Phase A** and provided:

- Production KV namespace ID
- Preview KV namespace ID
- Confirmation that the Pages project builds `main` successfully at its `*.pages.dev` URL (no worker yet — just static bundle)

See [INFRA.md](INFRA.md) Phase A for the user's instructions. When the user posts the two namespace IDs in chat, resume at Phase B.

---

# Phase B — Code PR (agent)

All of the following lands in a single PR against `main`. Merging it auto-deploys to `*.pages.dev`; it does **not** affect `takehomeviz.com` yet.

## B.1 API client: `packages/web/src/lib/remoteState.ts` (new)

Thin client over the Worker, no Vue dependency, unit-testable with `fetch` mocked.

```ts
createState(state, { snapshot?: boolean }): Promise<{ id: string }>
  → POST /api/state  body: { state, snapshot }
  → { id }

getState(id): Promise<{ ok: true; state: DecodedUrlState; isSnapshot: boolean } | { ok: false; error: string }>
  → GET /api/state/:id
  → { state, isSnapshot }

updateState(id, state): Promise<void>
  → PUT /api/state/:id  body: { state }
  → 204
```

All response bodies are validated client-side with `urlStateSchema.parse` (reused from [packages/web/src/schemas.ts](packages/web/src/schemas.ts)).

GUID format: **10-char base62**, server-generated. Client never mints GUIDs.

## B.2 Store rewire: [packages/web/src/stores/scenarios.ts](packages/web/src/stores/scenarios.ts)

Replace hash-based load/persist with KV-backed flow.

**Delete:**
- `loadFromHash()` and its call sites.
- The hash-persist watcher at [scenarios.ts:334](packages/web/src/stores/scenarios.ts#L334).
- Imports from `../lib/urlState`.

**Add refs:**
- `currentId: Ref<string | null>` — GUID in the URL.
- `isForkable: Ref<boolean>` — true when the loaded record is a snapshot; gates fork-on-write.
- `loadError: Ref<string | null>` — already exists; reuse.

**New load flow** (`loadFromUrl()`, called once on app mount):
```
id = new URLSearchParams(location.search).get('id')
if (!id) → load example data; currentId = null; isForkable = false; return
res = await getState(id)
if (!res.ok) → surface loadError; load example data; currentId = null; return
hydrate store from res.state
currentId = id
isForkable = res.isSnapshot
```

**New persist flow** (replaces hash watcher):
- Same deep watch on `[scenarios, fx, displayCurrency, chartRange]`.
- Debounce raised to **1000ms** (every write is a network/KV write now).
- Watcher is armed only after `loadFromUrl()` resolves, so hydration assignments don't trigger a persist.
- On fire:
  - If `currentId === null` → **lazy mint**: `{ id } = await createState(state)`; `currentId = id`; `history.replaceState(null, '', \`?id=\${id}\`)`.
  - Else if `isForkable` → **fork-on-write**: `{ id } = await createState(state)` (no snapshot flag); `currentId = id`; `isForkable = false`; `history.replaceState(...)`.
  - Else → `await updateState(currentId, state)`.
- In-flight guard: if a write is already in flight, remember "dirty again" and re-fire once it settles. Latest-wins.

**New actions:**
- `snapshotSerializedState(): DecodedUrlState` — deep-clones current store state. Used by Share and Download.
- `hydrateFromState(state: DecodedUrlState)` — mirrors the success branch of `loadFromUrl` but does *not* touch `currentId`/`isForkable`; marks store dirty so the next watcher tick persists under the existing GUID (or lazy-mints). Used by Upload.

## B.3 Header UI: [packages/web/src/components/AppHeader.vue](packages/web/src/components/AppHeader.vue)

Replace `onShare()` at [AppHeader.vue:17-46](packages/web/src/components/AppHeader.vue#L17-L46):

```ts
async function onShare() {
  const snap = store.snapshotSerializedState()
  const { id } = await createState(snap, { snapshot: true })
  const url = `${location.origin}${location.pathname}?id=${id}`
  await navigator.clipboard.writeText(url)   // keep existing fallback branch
  shareState.value = 'copied'
}
```

Add two icon-only buttons next to Share at [AppHeader.vue:118](packages/web/src/components/AppHeader.vue#L118):

- **Download** (`faDownload`) — `store.snapshotSerializedState()` → pretty JSON → `Blob` download `takehomeviz-<yyyy-mm-dd>.json`.
- **Upload** (`faUpload`) — hidden `<input type="file" accept=".json,application/json">`. On change: read → `JSON.parse` → `urlStateSchema.parse` → `store.hydrateFromState(parsed)`. On failure surface via `loadError`.

Register `faDownload` / `faUpload` in the FontAwesome `library.add` call.

## B.4 Worker: `packages/web/functions/api/state/[[path]].ts` (new)

Cloudflare Pages Functions handler. Target ~80 LOC.

- KV bound as `env.STATE_KV`.
- `POST /api/state`: reject if `Content-Length > 100_000`; `{ state, snapshot } = JSON.parse(body)`; validate `state` with `urlStateSchema` (relative import from `../../../src/schemas.ts`); generate 10-char base62 id via `crypto.getRandomValues`; `KV.put(id, JSON.stringify({ state, isSnapshot: !!snapshot }), { expirationTtl: 60*60*24*90 })`; respond `201 { id }`.
- `GET /api/state/:id`: `raw = await KV.get(id)`; null → `404`; parse; `ctx.waitUntil(KV.put(id, raw, { expirationTtl: 60*60*24*90 }))` (refresh-on-read); respond `200 { state, isSnapshot }`.
- `PUT /api/state/:id`: size + validation; read existing record and **preserve its `isSnapshot` flag** (belt-and-braces — a PUT must never silently demote a snapshot); if none exists, create with `isSnapshot: false`; `expirationTtl: 60*60*24*90`; respond `204`.
- All responses JSON; CORS not needed (same-origin under Pages).

## B.5 Schema sharing

Worker imports `urlStateSchema` directly from `../../../src/schemas.ts`. Pages Functions bundles with esbuild and can reach into `src/`. Promote to a `packages/shared` workspace only if bundling breaks.

## B.6 `packages/web/wrangler.toml` (new)

```toml
name = "takehomeviz"
compatibility_date = "2026-04-01"
pages_build_output_dir = "dist"

[[kv_namespaces]]
binding = "STATE_KV"
id = "<PROD_KV_ID from Phase A>"
preview_id = "<PREVIEW_KV_ID from Phase A>"
```

⚠️ Agent: do not use placeholder IDs. If real IDs are not available, halt and re-request them — do not ship a PR with `<PROD_KV_ID>` in the file.

## B.7 Delete legacy code

- Delete [packages/web/src/lib/urlState.ts](packages/web/src/lib/urlState.ts).
- Trim `legacyDecodeAndMigrate` from [packages/web/src/schemas.ts](packages/web/src/schemas.ts); keep `urlStateSchema`.
- Remove `lz-string` from [packages/web/package.json](packages/web/package.json).
- Delete hash encode/decode tests in [packages/web/src/lib/](packages/web/src/lib/).

⚠️ **Do NOT delete in this phase**: [.github/workflows/deploy.yml](.github/workflows/deploy.yml) and `packages/web/public/CNAME`. Those stay until Phase D so GitHub Pages keeps serving production during Phase B.

## B.8 Tests

- Unit tests for `remoteState.ts` (happy path, 404, validation error) with `vi.fn()` for `fetch`.
- Store tests: no-id load; id load; lazy-mint on first edit; fork-on-write when `isForkable`; edit-in-place when `!isForkable`; upload hydrate + persist.
- Worker tests via `@cloudflare/vitest-pool-workers` + Miniflare KV: POST → id; GET returns `{ state, isSnapshot }` and refreshes TTL; PUT preserves snapshot flag; oversized payload → 413.
- Add `src/lib/remoteState.ts` to coverage include in [packages/web/vite.config.ts](packages/web/vite.config.ts); keep 90% thresholds.

## B.9 Local verification (before opening PR)

1. `pnpm --filter @takehomeviz/web build && wrangler pages dev packages/web/dist`
2. `/` no id → example data, no network. Edit → URL becomes `?id=<10char>`, one `POST /api/state`.
3. Further edits → `PUT /api/state/<id>`, debounced 1s.
4. Click Share → clipboard gets a different `?id=<X>`. Sharer's URL bar unchanged.
5. Open snapshot URL in a private window → loads. Edit → URL rewrites to a third id (fork-on-write). Reload original snapshot → still pristine.
6. Bookmark flow: copy your own `?id=<Y>`, open in another tab, edit → same `?id=<Y>` keeps updating (no fork).
7. Download JSON → Upload → round-trips; persists under current id.
8. `curl -XPOST` with 200KB body → 413.
9. `pnpm test` green, coverage ≥ 90%.

## B.10 Open PR, merge

After merge, Cloudflare Pages auto-deploys the worker + bundle to `*.pages.dev`.

---

# 🛑 STOP 1 — Before Phase C

Agent: after the PR merges, **halt** and ask the user to smoke-test on the `*.pages.dev` URL before the custom domain is flipped. Specifically ask them to verify, against `takehomeviz.pages.dev` (or whatever the project URL is):

- Auto-persist flow (B.9 steps 2–3)
- Share + fork-on-write flow (B.9 steps 4–5)
- Bookmark flow (B.9 step 6)
- Download/Upload round-trip (B.9 step 7)

Do not proceed to Phase D until the user confirms smoke tests passed **and** says Phase C is done.

---

# Phase C — Cutover (user)

Agent does nothing during this phase. See [INFRA.md](INFRA.md) Phase C. Summary of what the user does:

- Add rate-limiting rule (INFRA §C.1).
- Add `takehomeviz.com` and `www.takehomeviz.com` as custom domains on the Pages project (INFRA §C.2). DNS flips. GitHub Pages stops resolving for the apex domain within minutes.
- Set GitHub repo → Settings → Pages → Source: None (INFRA §C.3).
- Post-cutover sanity check: `takehomeviz.com` resolves to Pages, existing test ids still load.

---

# 🛑 STOP 2 — Before Phase D

Agent: wait for the user to explicitly say "cutover done" (or equivalent). Do not open the cleanup PR before that. Deleting `deploy.yml` or the CNAME file while GitHub Pages is still serving production would break the live site.

---

# Phase D — Cleanup PR (agent)

Small PR, no runtime behavior change.

- Delete [.github/workflows/deploy.yml](.github/workflows/deploy.yml).
- Delete `packages/web/public/CNAME` (or `packages/web/dist/CNAME` — check which is the source; the dist one is generated).
- Verify `.github/workflows/ci.yml` (lint + test) still passes and is the only remaining workflow. Cloudflare Pages now handles deploys.

Merge. Migration complete.

---

## Critical files touched across phases

- Phase B: [packages/web/src/stores/scenarios.ts](packages/web/src/stores/scenarios.ts), [packages/web/src/components/AppHeader.vue](packages/web/src/components/AppHeader.vue), [packages/web/src/schemas.ts](packages/web/src/schemas.ts), [packages/web/package.json](packages/web/package.json), [packages/web/vite.config.ts](packages/web/vite.config.ts); delete [packages/web/src/lib/urlState.ts](packages/web/src/lib/urlState.ts); new `packages/web/src/lib/remoteState.ts`, `packages/web/functions/api/state/[[path]].ts`, `packages/web/wrangler.toml`.
- Phase D: delete [.github/workflows/deploy.yml](.github/workflows/deploy.yml), `packages/web/public/CNAME`.

## Rollback

- **During Phase B**: if smoke tests fail on `*.pages.dev`, don't do Phase C. Revert the merge commit; GitHub Pages is untouched, so production is unaffected. Fix forward in a new PR.
- **During Phase C**: if the custom domain flip causes issues, remove the custom domain from the Pages project; DNS reverts within minutes (Cloudflare records TTL is low by default). GitHub Pages can be re-enabled from repo settings as a fallback until Phase D runs.
- **After Phase D**: rollback requires restoring `deploy.yml` and `CNAME`, re-enabling GitHub Pages, and flipping DNS back. Non-trivial but possible.
