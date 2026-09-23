#!/usr/bin/env bash
# Runs the real Bruno collection (collection-bookandsign/) as the e2e suite
# for the bookings + notes feature, against a running instance of the app.
#
# Scope: only the folders this feature owns.
#   - e2e-bootstrap: signs up a throwaway staff user and captures its token
#     (see collection-bookandsign/e2e-bootstrap/signup.bru); no committed
#     credential is used.
#   - bookings: the whole folder — every request in it creates what it
#     needs or chains an id from a previous response, so it is safe to run
#     in full against any database state.
#   - notes: only the requests that are self-contained (booking-scoped
#     notes, validation 400s, the missing-token 401s, and the
#     nonexistent-slot 404s). The slot/contract-scoped notes requests are
#     skipped on purpose: they depend on hand-seeded ids (slot_id, etc.)
#     from the legacy collection that this feature does not own — see
#     odd/tasks/booking-agenda.md, task T7.
#   - contracts-v4 (bookings): the contract + booking flow, explicitly
#     ordered (setup brand/package/extra -> create contract -> create
#     booking -> detail/token/list/without-events -> cancel/reopen/finalize
#     -> prep-profile automatable subset -> delete). Every id is captured
#     from a previous response, so it is safe to run in full against any
#     database state. The prep-profile subfolder's manual-only requests
#     (upload-url, the signed-URL PUT, and the two answer PATCHes that
#     depend on the uploaded asset path) are skipped: they need a real
#     Supabase bucket and Bruno "Developer Mode" — see
#     collection-bookandsign/contracts-v4 (bookings)/prep-profile/folder.bru.
#     The prep-profile automatable requests must run before the "delete
#     contract" step: a soft-deleted contract is no longer resolvable by
#     token, which prep-profile relies on.
#
# The app must already be running and reachable at the e2e environment's
# base_url (default http://localhost:3000); this script does not start it.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
bru_bin="$repo_root/node_modules/.bin/bru"
collection_dir="$repo_root/collection-bookandsign"

if [ ! -x "$bru_bin" ]; then
  echo "error: $bru_bin not found. Run 'pnpm install' first." >&2
  exit 1
fi

cd "$collection_dir"

exec "$bru_bin" run \
  "e2e-bootstrap" \
  "bookings" \
  "notes/create note (400 - invalid kind).bru" \
  "notes/create note (400 - invalid scope).bru" \
  "notes/create note (400 - invalid targetId type).bru" \
  "notes/create note (400 - missing content).bru" \
  "notes/create note (400 - missing targetId).bru" \
  "notes/create note (401 - missing token).bru" \
  "notes/create note (404 - slot not found).bru" \
  "notes/create note (booking).bru" \
  "notes/get notes (400 - invalid scope).bru" \
  "notes/get notes (400 - invalid targetId).bru" \
  "notes/get notes (401 - missing token).bru" \
  "notes/get notes (404 - slot not found).bru" \
  "notes/get notes (booking).bru" \
  "contracts-v4 (bookings)/00a - create brand (setup).bru" \
  "contracts-v4 (bookings)/00b - create package (setup).bru" \
  "contracts-v4 (bookings)/00c - create extra (setup).bru" \
  "contracts-v4 (bookings)/01 - create contract (packages + extras).bru" \
  "contracts-v4 (bookings)/02 - create booking with contractId.bru" \
  "contracts-v4 (bookings)/03 - get contract detail.bru" \
  "contracts-v4 (bookings)/04 - get contract detail by token (public).bru" \
  "contracts-v4 (bookings)/05 - get contracts list.bru" \
  "contracts-v4 (bookings)/06 - get contracts without events.bru" \
  "contracts-v4 (bookings)/07 - cancel contract.bru" \
  "contracts-v4 (bookings)/08 - reopen contract.bru" \
  "contracts-v4 (bookings)/09 - finalize contract.bru" \
  "contracts-v4 (bookings)/prep-profile/01 - get prep profile (public).bru" \
  "contracts-v4 (bookings)/prep-profile/02 - patch prep profile answer (public).bru" \
  "contracts-v4 (bookings)/prep-profile/03 - patch prep profile answers bulk (public).bru" \
  "contracts-v4 (bookings)/prep-profile/04 - unlock prep profile question (admin).bru" \
  "contracts-v4 (bookings)/10 - delete contract + cascade.bru" \
  -r \
  --env e2e \
  "$@"
