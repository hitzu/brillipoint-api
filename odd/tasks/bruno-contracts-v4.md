# Bruno contracts-v4 (bookings) collection + e2e

## Objective
Single, discoverable Bruno folder `collection-bookandsign/contracts-v4 (bookings)` documenting and protecting the core contract flow with bookings, run as part of `scripts/run-bruno-e2e.sh`.

## Why
Contract creation + booking linkage is a core app flow. Current `contracts/` and `contracts-v3 (extras)/` use hardcoded seeded ids (slotId 31, contract_id 5, package_id 15) and are not runnable as e2e.

## Scope
- Create `contracts-v4 (bookings)/` with chained requests (ids captured from responses, no hardcoded seed ids).
- Move lifecycle (list, without events, cancel, reopen, finalize, delete) and prep-profile requests into it.
- Delete `contracts/` and `contracts-v3 (extras)/`.
- Keep `contracts-v2 (future multi-slot)/` until slots are removed (user decision).
- Add v4 (including automatable prep-profile) to `run-bruno-e2e.sh`.
- Prep-profile signed-URL upload (Supabase + `fs`, Developer Mode) stays in the collection but is excluded from the e2e run, along with the requests that depend on its uploaded asset path.

## Constraints
- Every request self-contained or chained from a previous response in the same run; safe against any DB state (unique skus/emails per run).
- Package/extra needed for creation are created inside the flow.
- Assertions (`tests {}` / `assert {}`) on status and key response shape, including `bookings` in detail/token/list.
- Follow conventions of `collection-bookandsign/bookings/`.

## TDD
- Mode: strict (source: user global config). For a Bruno collection the RED step = run the new e2e requests before they pass (e.g. assertions written first against missing wiring) where meaningful; runner: `bash scripts/run-bruno-e2e.sh` against a running app.

## Tasks
- [x] T1 — Create v4 core flow 01–10 (setup brand/package/extra → create contract → create booking → detail → token → list → without events → cancel → reopen → finalize → delete) with assertions.
- [x] T2 — Move prep-profile requests into `contracts-v4 (bookings)/prep-profile/`, chained to the v4 contract token; mark manual-only ones.
- [x] T3 — Wire v4 into `scripts/run-bruno-e2e.sh` (exclude manual upload chain); update script header comment.
- [x] T4 — Delete `contracts/` and `contracts-v3 (extras)/`.
- [x] T5 — Run full Bruno e2e green; record evidence.

## Acceptance criteria
- [x] `bash scripts/run-bruno-e2e.sh` passes including v4, repeatable twice in a row on the same DB. (evidence below)
- [x] No hardcoded seed ids in v4 (brand/package/extra/contract/booking ids all captured from prior responses; only the run-unique `v4_run_id`/`v4_booking_date` anchors are computed).
- [x] Only `contracts-v2` and `contracts-v4` contract folders remain (`contracts/` and `contracts-v3 (extras)/` removed with `git rm`).

## Route declaration
- T1–T5: delegated direct (writer trigger: many non-trivial files).

## Progress
- Scope agreed with user 2026-09-22.
- Implemented 2026-09-22. Files:
  - `collection-bookandsign/contracts-v4 (bookings)/folder.bru` — run-unique anchor (`v4_run_id`, `v4_booking_date`, the latter anchored to 2033+ so it can never collide with `bookings/`'s own 2030±600-day overlap-guard fixtures).
  - `00a/00b/00c - create brand/package/extra (setup).bru` — fresh brand/package/extra per run (unique names via `v4_run_id`).
  - `01 - create contract (packages + extras).bru` — no `slotId`, `userId` from the e2e-bootstrap signup response (`e2e_user_id`, added as a var capture in `e2e-bootstrap/signup.bru`), `brandId` set so extras resolve, fixed `clientPhone` (`5215555550199`, stored as `v4_client_phone`) so the prep-profile subfolder's `?phone=` keeps matching.
  - `02 - create booking with contractId.bru` — links a booking to the contract via `contractId`.
  - `03..06` — get by id, get by token (public), list, without-events; all assert `bookings` is present with the created booking. `03` (by-id detail) asserts `items` (not `packages` — that endpoint's `ContractDetailDto` only populates `items`, a pre-existing asymmetry vs. the token/list endpoints which populate `packages`; left as-is, out of scope).
  - `07/08/09 - cancel/reopen/finalize contract.bru` — real state transitions (`confirmed → cancelled → confirmed → finalized`); `list`/`without events` deliberately run before `cancel` so they see the confirmed contract per the default `includeFinalized=false` filter.
  - `10 - delete contract + cascade.bru` — runs last (after prep-profile), since a soft-deleted contract is no longer resolvable by token/id.
  - `prep-profile/` — `01..04` automatable (get, patch answer, patch bulk, unlock admin), chained to `v4_contract_token`/`v4_client_phone`; `05..08` manual-only (`[manual]` suffix, Supabase signed-URL upload + `fs` Developer Mode), documented in `prep-profile/folder.bru`'s `docs {}` block and excluded from `run-bruno-e2e.sh`. Verified prep-profile has no contract-status guard in `ContractsPreparationProfileService`, so it only needs to run before the delete step, not before finalize.
  - `e2e-bootstrap/signup.bru` — added `e2e_user_id: res.body.userInfo.id` var capture (additive; used as the `userId` FK on contract creation).
  - `scripts/run-bruno-e2e.sh` — added the explicit contracts-v4 file list (setup → core flow → prep-profile automatable subset → delete), updated the header comment.
  - Removed `collection-bookandsign/contracts/` and `collection-bookandsign/contracts-v3 (extras)/` via `git rm`. `contracts-v2 (future multi-slot)/` untouched.

### TDD evidence
- RED (observed, real failures against wiring/status-code assumptions, not invented): first full run — `contracts-v4 (bookings)/03 - get contract detail` failed (`expected undefined to be an array`, caused by asserting `body.packages` on an endpoint that only populates `body.items`), and `07/08/09 - cancel/reopen/finalize` and `prep-profile/04 - unlock` failed (`expected 201 to equal 200` — these controller actions are plain `@Post()` with no `@HttpCode` override, so Nest's default is `201`, not `200`). Fixed the four test files to match actual, verified API behavior (not weakened to pass).
- GREEN, run 1: `52 (52 Passed)` requests, `79/79` tests.
- GREEN, run 2 (same test DB, no reset in between): `52 (52 Passed)` requests, `79/79` tests. Repeatability confirmed.
- `NODE_ENV=test npx jest --config jest.config.ts`: `Test Suites: 35 passed, 35 total`, `Tests: 531 passed, 531 total`.

### How the app was run
- Test DB already up via `docker-compose.yml` (`bookandsign-postgres-test` on `5433`, healthy) with `synchronize: true` for `NODE_ENV=test` (see `src/config/database/data-source.ts`) — schema (32 tables, correct `bookings.contract_id` FK, `users_role_enum` = `{admin, sales_agent}`) already in sync, no migration needed.
- Port `3000` was occupied by the user's own `nest start --watch` dev session (pre-existing, unrelated to this session) — left untouched per "never touch non-test databases" / don't disrupt the user's own process.
- Built (`npm run build`) and started a separate instance on `NODE_ENV=test PORT=3001 node dist/src/main.js` in the background, ran `bash scripts/run-bruno-e2e.sh --env-var base_url=http://localhost:3001` (the `--env-var` override, not a committed file change, since the committed `environments/e2e.bru` still points at `:3000` as documented), then killed that process (pid confirmed dead) once verification finished.

### Known pre-existing issue, checked and not applicable here
- `odd/tasks/contract-bookings-in-responses.md` reports `invalid input value for enum users_role_enum: "user"` in `test/contracts.e2e-spec.ts`'s jest e2e signup (that spec's DTO sends role `"user"`, which was never a valid enum value). The Bruno `e2e-bootstrap/signup.bru` sends role `"sales_agent"` (a real `users_role_enum` value), so it is unaffected — confirmed by the passing bootstrap signup in every run above. No DB/enum/auth changes made.

### Gaps / decisions for the user
- Manual-only prep-profile upload chain (05–08) was not run (needs a real Supabase bucket + Bruno Developer Mode `fs` access, per the task's own scope) — kept documented, excluded from CI as specified.
- `03 - get contract detail` asserts `items` rather than `packages` because that's what the by-id detail endpoint actually returns (pre-existing DTO/service asymmetry vs. the token-detail/list endpoints, which populate `packages`); flagging in case it's worth reconciling in a future change, out of scope here.
