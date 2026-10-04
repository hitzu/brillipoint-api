# Gallery expiration bypass

## Objective
Let staff reopen an expired public gallery (30 days after the event booking) for sales demos, via a checkbox in the admin event edit form.

## Problem / why
Public galleries switch to `finished` 30 days after `Booking.serviceStartsAt` (`EventsService.getPublicEventStatus`). Sales wants to show good past events to prospects; the expired screen is useless for that.

## Scope
- API: `events.gallery_status` enum `GALLERY_STATUS` (`auto` default | `demo`), replacing the T1 boolean (flags accumulate; a status override scales); `getPublicEventStatus` returns `active` for `demo`; editable through `PATCH /events/:id`; admin event read exposes `activePhotoCount` (non-soft-deleted photos).
- Front: gallery status select (was a checkbox) in `src/pages/event-edit/[id].tsx` with a warning when `activePhotoCount === 0`; admin list gallery link adds `&cache=off`.

## Constraints
- Do NOT bypass the 15-day upload guard (`assertEventNotExpired`); the flag only reopens viewing.
- Domain-only integration tests against real PostgreSQL (bookandsign-testing skill); migrations via bookandsign-migrations skill.

## Tasks
- [x] T1 (API, delegated writer) — column + migration, status bypass, DTO, `activePhotoCount`, tests.
- [x] T2 (Front, delegated writer) — checkbox + photo-count warning, payload builder, list link `&cache=off`, tests. Superseded by T4.
- [x] T3 (API) — replace boolean with galleryStatus enum (auto|demo).
- [x] T4 (Front) — replace the `bypassGalleryExpiration` switch with a `galleryStatus` select (`auto` | `demo`), payload sends `galleryStatus`; keep the photo-count warning and `&cache=off` link.

## Acceptance criteria
- Expired event with `galleryStatus=demo` → gallery/v2 event status `active`; `auto` → unchanged date-derived behavior. Public responses never expose `demo`.
- Uploads still blocked after 15 days regardless of flag.
- Edit form shows active photo count and warns when zero.
- Admin list link: `/fiesta/<token>?source=admin_page&cache=off`.

## Progress / evidence
- T1 done — route: delegated direct (writer). Commit `7ed63df`.
  - Migration `src/database/migrations/1791097169111-AddBypassGalleryExpiration.ts` (generated against dev DB; single additive `ADD COLUMN ... boolean NOT NULL DEFAULT false`, down drops only that column). Not applied to any non-test DB.
  - `getPublicEventStatus(booking, event, now?)` — `active` when `event.bypassGalleryExpiration`; threaded into v2 mapper, `SessionsService.getSession` and `getGallery`. `assertEventNotExpired` untouched.
  - Response shape: `bypassGalleryExpiration: boolean` on `EventResponseDto` (v1) and `EventV2ResponseDto`; `activePhotoCount: number` only on `GET /v2/events/id/:id` (admin edit read used by the front `getEventById`).
  - RED observed (13 failing), then GREEN: `NODE_ENV=test npx jest --config jest.config.ts src/events src/photos/sessions.service.spec.ts` → 17 suites, 323 tests passed.
  - `npx tsc --noEmit -p tsconfig.json` → 65 errors, identical count to base HEAD (all pre-existing, none introduced).
- T2 done — route: delegated direct (writer). Front commit `1eced8d` (bookandsign-front, same branch name).
  - Switch + "Fotos activas: N" + warning Alert when 0 in `src/pages/event-edit/[id].tsx`; payload always sends the flag; list link adds `&cache=off`.
  - RED→GREEN: eventPayload vitest 6/6. `tsc --noEmit` 0 errors. Full vitest 510 pass / 1 pre-existing failure (partnersRepository, fails on base too). Lint not run (no ESLint config).
- T1/T2 superseded in part by T3: the boolean was replaced before release (migration `1791097169111-AddBypassGalleryExpiration.ts` was never applied anywhere and was deleted).
- T3 done — route: delegated direct (writer). Commit `1284b98`.
  - Enum `GALLERY_STATUS { AUTO = 'auto', DEMO = 'demo' }` in `src/events/constants/gallery_status.enum.ts` (matches `BOOKING_STATUS` convention); column `gallery_status` is a postgres enum (`events_gallery_status_enum`), NOT NULL default `'auto'` (dominant pattern: bookings.status, photos.status).
  - Migration `src/database/migrations/1791129587532-AddEventGalleryStatus.ts` via `pnpm run db:gen` against the dev DB (verified first: no `bypass_gallery_expiration`/`gallery_status` column, chain head `RemoveBrandKits`). Up: `CREATE TYPE ... AS ENUM('auto','demo')` + `ADD "gallery_status" ... NOT NULL DEFAULT 'auto'`; down drops column then type. Gate passed. Not applied.
  - Response shape: `galleryStatus?: 'auto' | 'demo'` on `GET /v2/events/id/:id` (with `activePhotoCount`) and v1 `EventResponseDto` (PATCH and other admin v1 reads); omitted from public `GET /events/:token` and `GET /v2/events/:token`. Public `status` stays `active | finished`.
  - `SessionsService.getGallery` now reads the event entity (`findOneByToken`) because the public DTO no longer carries the override. `assertEventNotExpired` untouched.
  - RED observed (events spec compile failure on missing enum; DTO rejection cases; sessions gallery tests), then GREEN: `NODE_ENV=test npx jest --config jest.config.ts src/events src/photos/sessions.service.spec.ts` → 17 suites, 334 tests passed.
  - `npx tsc --noEmit -p tsconfig.json` → 65 errors, same as base (delta 0).
  - `grep -rn bypassGalleryExpiration src test` → empty.
- Pending: T4 (front); push/PR (user decision); run migration on deploy.

- T4 done — route: delegated direct (writer). Front commit `5066dda`: `Form.Select` "Estado de la galería" (auto|demo), type `EventGalleryStatus` (name `GalleryStatus` already taken by public status). eventPayload vitest 6/6 RED→GREEN, `tsc` 0 errors, no `bypassGalleryExpiration` left.
- Pending: push/PR (user decision); run migration `1791129587532-AddEventGalleryStatus` on deploy.
