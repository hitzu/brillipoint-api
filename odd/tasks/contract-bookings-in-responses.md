# Contract bookings in responses

## Objective
Expose each contract's `bookings` in every contract response (detail, public-by-token, list, create), while keeping the legacy `slot` / `contractSlots` fields untouched. Preparation for the upcoming move from slots to bookings.

## Scope
- In: `ContractDetailDto` (getDetail + all mutations returning it, getDetailByToken), `ContractDto` (list, create).
- Out: slots calendar v2 (`SlotsCalendarV2ContractInfoDto`) — slot-centric, revisit later.
- No migration: `bookings.contract_id` FK already exists.

## Constraints
- Keep legacy slot relations and response fields as-is.
- DTOs use `excludeExtraneousValues: true` → new field needs `@Expose()` + `@Type()`.
- List: avoid join fan-out with `contractSlots`; load bookings in a second batched query (`In(contractIds)`).
- Soft-deleted bookings must not appear.
- Public token endpoint exposes only a summary DTO (no extra PII beyond what booking summary needs).

## TDD
- Mode: strict (source: user global config "Strict TDD Mode: enabled").
- Runner: `npm test` (jest, `jest.config.ts`); e2e: `npm run test:e2e`.

## Tasks
- [x] T1 — Entity: add `Contract.bookings` (`@OneToMany`) and inverse on `Booking.contract`. Route: delegated writer (together with T2–T4).
  - `src/contracts/entities/contract.entity.ts`: `@OneToMany(() => Booking, (booking) => booking.contract) bookings?: Booking[]`.
  - `src/bookings/entities/booking.entity.ts`: `@ManyToOne(() => Contract, (contract) => contract.bookings, ...)`.
  - `src/contracts/contracts.module.ts`: registered `Booking` in `TypeOrmModule.forFeature`, injected `Repository<Booking>` into `ContractsService`.
- [x] T2 — DTO: `ContractBookingSummaryDto`; add `bookings` to `ContractDetailDto` and `ContractDto`.
  - New `src/contracts/dto/contract-booking-summary.dto.ts`: `id, status, purpose, eventDate, serviceStartsAt, serviceEndsAt, title, venueName` (no `mapsUrl`, no `contract` back-reference).
  - `bookings!: ContractBookingSummaryDto[]` added to both DTOs with `@Expose()` + `@Type()`.
- [x] T3 — Service detail/token: load `bookings` in `getDetail` and `getDetailByToken`, map into DTO.
  - Added `findBookingsByContractId` (repo `find` where `contractId`, `order: { serviceStartsAt: 'ASC' }` — soft-deleted excluded by TypeORM's `@DeleteDateColumn` default).
- [x] T4 — Service list/create: batched bookings load for `list()`; `createContract` returns `bookings` (empty or linked).
  - `findBookingsByContractIds` does one `find({ where: { contractId: In(ids) } })`, skipped when `ids` is empty, grouped into a `Map` in memory (no `leftJoinAndSelect`, no fan-out).
  - `createContract`: `createContract` does not itself link any booking to the new contract (confirmed: commit `deac965` "booking service prevent overlap on contract creation" only touched `src/bookings/*`, not `contracts.service.ts`); bookings are only linked via `POST /bookings` with an optional `contractId` afterward. So `createContract`'s returned `bookings` is always `[]` today; the load is still generic/future-proof.
- [x] T5 — Tests (RED first) for detail, token, list, create including soft-deleted exclusion.
  - See Verification below for RED/GREEN evidence.

## Acceptance criteria
- Every contract response above includes `bookings: BookingSummary[]` (empty array when none).
- Legacy `slot`/`contractSlots` output unchanged.
- Soft-deleted bookings excluded.
- Existing tests green.

## Checks
- `npm test`
- `npm run test:e2e` (contracts)
- `npx tsc --noEmit` / lint

## Route declaration
- T1–T5: delegated direct (writer trigger: 2+ non-trivial files — entity, DTOs, service, tests).

## Progress
- Exploration done; scope confirmed by user (calendar v2 out).
- Implementation done (T1–T5). RED confirmed first (5 failing assertions in `src/contracts/contracts.service.spec.ts` referencing `.bookings`), then implemented to GREEN.

## Verification (2026-09-22)
- `NODE_ENV=test npx jest --config jest.config.ts src/contracts/contracts.service.spec.ts`: 40/40 pass (was 5 failing pre-implementation).
- `NODE_ENV=test npx jest --config jest.config.ts src/contracts src/bookings`: 147/147 pass.
- `NODE_ENV=test npx jest --config jest.config.ts` (full): 531/531 pass.
- `npx tsc --noEmit -p tsconfig.json`: pre-existing errors only, in files this change does not touch (`src/notes/notes.service.spec.ts`, `src/slots/slots.service.spec.ts`, `src/terms/terms.service.spec.ts`, `src/users/user.service.spec.ts`, `test/contracts.e2e-spec.ts`, `test/factories/contracts/contract-package.factory.ts`) — confirmed via `git diff --stat` / `git log` that none of these files are part of this change.
- `npm run lint`: no `lint` script exists in `package.json` (scripts: dev, build, start, test, test:watch, test:coverage, db:gen, db:run, db:revert, db:status, db:seed:from-production, test:e2e, test:e2e:bruno) — not applicable.
- `npm run test:e2e -- contracts`: DB is up (`bookandsign-postgres-test` on 5433), but the single e2e spec fails pre-existing, unrelated to this change: `invalid input value for enum users_role_enum: "user"` during `/auth/signup` in `test/contracts.e2e-spec.ts`'s `beforeEach` (test DB's `users_role_enum` is out of sync with the `role` value the signup DTO sends). Confirmed `test/contracts.e2e-spec.ts` has zero diff from this change (`git log -1` shows commit `0d5d558...`, untouched here). Reported as blocked/pre-existing, not faked.

## Decisions/gaps for the user
- `createContract` never links a booking to the contract it creates today (verified against commit `deac965`, which only touched `src/bookings/*`); its `bookings` field will always be `[]` until a future change wires booking creation into contract creation. The load is implemented generically so it "just works" once that wiring exists.
- Bookings are not filtered by status (cancelled bookings included), matching the instruction — no status-filtering convention found elsewhere in the codebase.
- `test/contracts.e2e-spec.ts` is already broken independent of this change (both a pre-existing `tsc` error — `SLOT_PERIOD.MORNING` doesn't exist — and a pre-existing runtime DB enum mismatch on `/auth/signup`). Worth a separate fix; out of scope here.
