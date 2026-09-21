# Unified bookings

## Objective

Collapse the two booking-creation paths into a single `POST /bookings` that takes an
optional `contractId`, and delete the `BOOKING_TYPE` enum that existed only to label
which path a booking came from.

## Problem

`booking.type` is 100% derivable from `contract_id`. Both writers set them in lockstep
(`bookings.service.ts:39` → `INTERNAL` + `contractId: null`; `contracts.service.ts:215` →
`COMMERCIAL` + the contract id) and no code path ever reads it to decide anything — the
only reader copies it into the agenda DTO. It is a denormalization with no consumer that
can silently diverge from `contract_id`.

The two creation paths were not justified by the enum but by a transaction inside
`ContractsService.createContract`. That transaction protected nothing: a contract created
with `slotId` never produced a booking at all, and the `hasSchedule` path is unused in
production.

## Why

A contract is deliberately meant to carry MANY bookings — the event plus scouting, venue
visits and makeup/hair trials. `BOOKING_PURPOSE` already encodes exactly that model and
its docblock says so. `BOOKING_TYPE` and the single inlined commercial booking were
fighting the intended design.

## Scope

Authorized: `src/bookings/**`, `src/contracts/contracts.service.ts`,
`src/contracts/dto/create-contract-from-slots.dto.ts`, `src/contracts/contracts.service.spec.ts`,
`test/factories/bookings/booking.factory.ts`, `src/database/migrations/**`,
`collection-bookandsign/bookings/**`.

Out of scope: deprecating the slots module itself, and the duplicated
`CONTRACT_SLOT_PURPOSE` / `BOOKING_PURPOSE` enums (they collapse when slots go).

## Constraints

- No unique index on `contract_id`: N bookings per contract is the desired model.
- `contractId` must NOT imply `purpose = EVENT`. The client always sends `purpose`.
- `slotId` stays OPTIONAL. Slots are being deprecated, so contracts must not start
  requiring one.
- TDD: enabled (source: CLAUDE.md "Strict TDD Mode: enabled"). Runner: `npm test <module>.service`.
  Red before green.
- Migrations: follow the `bookandsign-migrations` skill. `pnpm run db:gen`, then the
  Generation Gate. This change OWNS the `DROP COLUMN type` and `DROP TYPE bookings_type_enum`
  statements; anything else in the generated file is drift and stops the task.
- Node: `nvm use v24.16.0` before any db script (system node is v26.9.0).

## Delivery

Strategy: `ask-on-risk`. Forecast ~350 authored changed lines → single PR unless the
running count passes ~400.

## Tasks

- [x] **T1 — Remove `BOOKING_TYPE` from the domain.** Route: delegated.
  Trigger: writer (5+ non-trivial files). Delete `src/bookings/constants/booking_type.enum.ts`,
  the `type` column on `Booking`, the `type` field on `ScheduleAgendaEntryDto`, its mapping in
  `BookingsAgendaService.toEntry`, the assignment in both creation sites, the factory attr, and
  every spec reference. Checks: `npm test bookings`, `npm test contracts.service`.
- [x] **T2 — Migration dropping the column and the enum type.** Route: inline.
  Entity already changed in T1. `pnpm run db:gen` → Generation Gate → `pnpm run db:run` →
  Convergence Check (`db:gen` must report no changes).
- [x] **T3 — Unified `POST /bookings`.** Route: delegated. Trigger: writer.
  `CreateInternalBookingDto` → `CreateBookingDto` with optional `contractId`. `createInternal`
  → `create`, persisting `contractId` and rejecting an unknown contract with 404
  (`EXCEPTION_RESPONSE.CONTRACT_NOT_FOUND`). Delete `POST /bookings/internal`. Checks:
  `npm test bookings.service` — new red cases for "persists contractId", "404 on unknown
  contract", "allows a second booking on the same contract".
- [x] **T4 — Strip schedule and booking creation out of contracts.** Route: delegated.
  Remove `eventDate` / `serviceStartsAt` / `serviceEndsAt` / `title` / `venueName` / `mapsUrl`
  from `CreateContractFromSlotsDto`, the `hasSchedule` computation, the
  `!hasSlotId && !hasSchedule` rule, the range check and the `if (hasSchedule)` booking block.
  A contract may now be created with no date at all. Checks: `npm test contracts.service`.
- [x] **T5 — Bruno collection.** Route: inline. Delete the 5 requests hitting
  `/bookings/internal`, re-point the agenda fixtures at `POST /bookings`.

## Acceptance criteria

- `grep -rn BOOKING_TYPE src test` returns nothing.
- One booking endpoint: `POST /bookings`, `contractId` optional.
- Two bookings can be attached to the same contract with different `purpose`s.
- A contract can be created with neither `slotId` nor any schedule.
- `pnpm run db:gen` reports no pending changes after the migration.
- Full suite green.

## Progress

**T1 + T2 done** — shipped together as one work unit: committing T1 alone would leave the
entity without a column the database still declares `NOT NULL`, so every insert in dev
would fail on that commit.

- T1 verified: `grep -rn BOOKING_TYPE src test` returns nothing. `npm test bookings` →
  4 suites, 55/55 passed (parent spot check re-ran this). `npm test contracts.service` →
  1 suite, 39/39 passed (writer-reported). 11 files changed, +4/-44.
- T2 verified: `src/database/migrations/1789972839399-Migration.ts`. Generation Gate passed
  — the file held exactly two statements, `DROP COLUMN "type"` and `DROP TYPE
  "bookings_type_enum"`, both owned by this change, no drift.
  The generated `down()` was **hand-corrected**: it re-added the column `NOT NULL` in a
  single statement, which fails against any table holding rows (dev has 19). It now adds
  the column nullable, backfills from `contract_id`, then sets `NOT NULL`. Proven by an
  actual `db:revert` → 3 `commercial` (all with a `contract_id`) and 16 `internal` (none),
  matching the pre-drop distribution exactly, then re-applied.
  Convergence Check: `pnpm run db:gen` → "No changes in database schema were found".

- T3 verified: red confirmed first — `persists contractId`,
  `returns the contract summary`, `throws NotFoundException when contractId
  points at no contract` failed for the right reason (hardcoded `null`
  contractId/contract, no validation) against a mechanically-renamed
  `create`/`CreateBookingDto` that still had the old body. Implementation
  added `resolveContract` (404 via `EXCEPTION_RESPONSE.CONTRACT_NOT_FOUND`,
  code 43) and attached the validated contract to the response.
  `npm test bookings.service` → 20/20. `npm test bookings` → 4 suites,
  59/59. `npm test contracts.service` → 1 suite, 39/39 (untouched, run as
  regression check). 13 files changed (+156/-48 by diffstat, including 4
  renames). `grep -rn BOOKING_TYPE src test` → empty.

- T3 parent review: the writer left `RescheduleBookingDto extends CreateBookingDto`, which
  silently inherited `contractId` and documented it as "accepted but ignored" — the same
  silent-ignore this feature is removing from the contract DTO. Changed inline to
  `OmitType(CreateBookingDto, ['contractId'])` so the type and the Swagger contract both
  state that a reschedule cannot move a booking between contracts. Re-ran
  `npm test bookings` → 59/59.
- Pre-existing, NOT ours: `npx tsc --noEmit` reports
  `contracts.service.spec.ts(181,9) 'name' does not exist in type 'Partial<Event>'`. That
  line is an `eventFactory.create` call untouched by any diff in this feature.

- T4 verified: red confirmed first — stashed the (not-yet-written) production
  changes, added the new spec case "should create and persist a contract when
  neither slotId nor any schedule is provided" against the untouched service,
  and it failed with `BadRequestException: Either slotId or a schedule
  (eventDate, serviceStartsAt, serviceEndsAt) is required` at
  `contracts.service.ts:138`, the exact rule being removed. Restored the
  production changes and re-ran: green.
  `src/contracts/contracts.service.ts`: removed the `hasSchedule` computation
  and its docblock, the `!hasSlotId && !hasSchedule` 400, the
  `serviceEndsAt <= serviceStartsAt` range check, and the whole
  `if (hasSchedule) { ... }` booking-creation block inside the transaction;
  dropped the now-unused `Booking`/`BOOKING_PURPOSE`/`BOOKING_STATUS` imports
  (`BadRequestException` stays — still used by `resolveExtrasForContract`).
  `src/contracts/dto/create-contract-from-slots.dto.ts`: removed `eventDate`,
  `serviceStartsAt`, `serviceEndsAt`, `title`, `venueName`, `mapsUrl` and their
  docblock/validators; dropped the now-unused `IsDate`/`IsUrl`/`Matches`
  imports.
  `src/contracts/contracts.module.ts`: removed `Booking` from
  `TypeOrmModule.forFeature([...])` — `grep -rn "Booking" src/contracts/`
  after the service change showed only the module registration and the spec
  file's own DI token (the spec provides its own `getRepositoryToken(Booking)`
  independent of the module), so nothing in the contracts module still needed
  it.
  `src/contracts/contracts.service.spec.ts`: in the
  `createContract (commercial booking, contract-first)` describe block —
  deleted "should create the contract and one commercial booking..." (tested
  the removed inline-booking path), deleted "should create both the slot link
  and a commercial booking..." (its slot-link half was already covered by the
  kept legacy-slot case, so deleting the booking half left nothing new),
  deleted "should throw BadRequestException when neither slotId nor a
  schedule is provided" (asserts exactly the rule being removed — replaced by
  the new case), deleted "should throw BadRequestException when the schedule
  fields are explicitly null" and "...when serviceEndsAt is not after
  serviceStartsAt..." and "should roll back the booking when the transaction
  fails..." (all three exercise removed validation/booking logic and
  reference DTO fields that no longer exist). Kept "should keep legacy slot
  behavior and create no booking when the payload has slotId" unchanged (no
  schedule-field assertions to drop — it never referenced them). Renamed the
  describe block to `createContract (optional slotId, no schedule)` since
  "commercial booking, contract-first" no longer describes any surviving
  test. Removed the now-unused `BOOKING_PURPOSE`/`BOOKING_STATUS` imports.
  `npm test contracts.service` → 1 suite, 34/34 passed. `npm test bookings` →
  4 suites, 59/59 passed (regression check, untouched by this task).
  `npx tsc --noEmit`: only pre-existing errors outside this task's scope
  (`contracts.service.spec.ts(179,9)` — the known `Partial<Event>` issue,
  now at line 179 instead of 181 because two unused imports were removed
  above it; plus unrelated `user.service.spec.ts`, `contracts.e2e-spec.ts`,
  and `contract-package.factory.ts` errors that predate this change).
  Bruno collection: `grep -rn "serviceStartsAt\|eventDate" collection-bookandsign/contracts*`
  matches only `contracts-v2/02` and `contracts-v2/04`, which send `eventDate`
  to `/slots` and `/contracts/:id/slots/reserve` (a `Slot` field, unrelated to
  `CreateContractFromSlotsDto`). None of the four `POST /contracts` requests
  (`contracts/create contract.bru`, `contracts-v2/01`, `contracts-v3/01`,
  `promotions-tiers/04`) send any schedule field — no Bruno changes needed.
  Not committed, per instruction.

- T4 parent review: the writer deleted `should roll back the booking when the transaction
  fails after the contract is saved`, which asserted TWO things — that no booking was left
  behind (obsolete) and that no CONTRACT was left behind (still live). After the deletion
  `grep -n "rollback\|transaction" contracts.service.spec.ts` returned nothing, so the
  contract-side guard was gone. Restored as `should leave no contract behind when extra
  validation aborts the creation`, next to the existing cross-brand-extra rejection case
  which only asserted the throw. `npm test contracts.service` → 35/35.

- T5 done. The two `SUGGESTION` findings from the approved review of the narrow candidate
  are closed with real HTTP evidence, not just unit coverage:
  `create booking (404 - contract not found)` and
  `create booking (400 - non-integer contractId)`. Ran `npm run test:e2e:bruno` against the
  running dev instance → 34 requests, 51/51 tests passed, both new requests confirmed
  green by name.
- **Regression caught by the full suite, introduced in T3**: `BookingsService` gained a
  second constructor dependency (`ContractRepository`), and `notes/notes.service.spec.ts`
  wires the real `BookingsService` into its own `TestingModule` without that token, so all
  12 notes cases failed with `Nest can't resolve dependencies of the BookingsService`.
  Neither the T3 nor the T4 writer caught it because both ran only `npm test bookings` and
  `npm test contracts.service`. Fixed by providing `getRepositoryToken(Contract)` in that
  spec. **Lesson for the next task: run the FULL suite before committing, not just the
  module under change — a constructor signature change reaches every spec that builds that
  provider.**
- Full suite: `npm test` → 34 suites, 512/512 passed.

## Acceptance criteria — verified

- `grep -rn BOOKING_TYPE src test` → nothing.
- One booking endpoint: `POST /bookings`, `contractId` optional; `POST /bookings/internal`
  gone (confirmed 404 against the running instance).
- Two bookings on one contract with different purposes: covered in
  `bookings.service.spec.ts`.
- A contract can be created with neither `slotId` nor any schedule: covered in
  `contracts.service.spec.ts`.
- `pnpm run db:gen` → "No changes in database schema were found".
- Full suite green.

## Next step

T5 — Bruno collection (out of scope for this task; T4's own Bruno check found
nothing to change).
