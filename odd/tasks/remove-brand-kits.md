# Remove brand kits

## Objective

Drop the brand-kit feature entirely (not in production yet). Theme layers become: Brillipoint default (code-owned) -> preset (`eventThemeId`) -> event `themeOverrides`. Company/branded events are authored per event via `themeOverrides` (colors, `socialCta`, `rewardPromo`), with the company name stored as `honoreesNames`.

## Why

Kits (client kit on event, business kit on brand, Brillipoint kit row) have no real use case: brands other than Brillipoint/photobooth never use the party theme, and repeat clients get a new event. Removing it now is cheap because there is no production data.

## Scope

- API: remove `brand-kits` module (entity, controller, service, DTOs, seed row), `event.brandKitId`, `brand.brandKitId`, client/business kit layers in `event-theme.service.ts`, inline `brandKit`/`brandKitId`/`brandKitName` on preview, kit owner type for theme-asset uploads.
- Move Brillipoint defaults (socialCta, rewardPromo, any visual overrides from `brillipoint-kit.seed.ts`) into a code-owned default layer; keep the existing safety-net behavior (CTA/promo always resolve to Brillipoint when the event sets nothing).
- Remove the `{{brandName}}` placeholder (only `{{honoreesName}}` remains).
- Destructive migration dropping kit table/columns (bookandsign-migrations gate). No data migration (no prod).
- Front (`bookandsign-front`): remove kit types/references in `themeContract.ts` and related.
- Skill `bookandsign-theme-authoring`: drop the company/kit path; company = per-event `themeOverrides` + `honoreesNames`.

## Out of scope

- Any change to event `themeOverrides` semantics, presets, or the brand section editor.

## Tasks

- [x] T1 — API: code-owned Brillipoint default layer replacing kit lookups; remove client/business kit layers and preview kit inputs; drop `{{brandName}}`. Tests first.
- [x] T2 — API: remove brand-kits module, entity relations, theme-asset kit owner, seeds; destructive migration (reviewed with migrations skill gate).
- [x] T3 — Front: remove kit types/references. Done in bookandsign-front `refactor/remove-brand-kits` (a9171e9, 6332056, 2ea3a63), stacked on `feat/event-brand-section`. Browser-validated 2026-10-03 on xv-rosita-2: inherited Brillipoint CTA + promo, and a company brand (tokens, socialCta with `{{honoreesName}}`, `rewardPromo: null`).
- [x] T4 — Skill: remove company/kit path, document per-event company flow. `~/.claude/skills/bookandsign-theme-authoring` v2.0 (outside any repo; backup of v1 in /tmp). `assets/company.example.json` preview checked against local API: 0 warnings. Found: `rewardPromo.handle` rejects hyphens (documented).

## Acceptance criteria

- Event with no `socialCta`/`rewardPromo` resolves Brillipoint CTA and promo exactly as before.
- Event `themeOverrides.socialCta`/`rewardPromo` still win.
- No `brandKit*` symbols left in API src (except historical migrations) or front src.
- `npm test` green in API; `npx vitest run` green for touched front areas.

## Progress

- Branches: API `refactor/remove-brand-kits`.
- T1 route: delegated direct (writer trigger: 10+ non-trivial files across theme service, layers, DTOs, specs).
- T1 evidence: RED observed (3 tests: brandName placeholder rejection, brandName omitted from params, default promo ignores kit row); GREEN `jest src/events` 291/291 (parent spot check), `jest src/events src/brand-kits` 333/333, `npm test` 829/829 in 3 of 5 runs (intermittent `PhotosService › should paginate photos using limit and cursor`, passes in isolation). `tsc --noEmit`: 66 errors vs 65 at base (pre-existing in unrelated specs); new one is TS2589 type-depth in `events.service.spec.ts`.
- T1 commit: cd2a58e.
- T1 notes: Brillipoint defaults now live in `src/events/theme/brillipoint-default.ts`; seed re-exports it until T2. `socialCta.brandKitKey` kept for byte-identical public output (pending decision).
- T2 route: delegated direct (writer trigger: 60+ files across module removal, entities, DTOs, specs, Bruno docs, migration).
- T2 decision: `socialCta.brandKitKey` removed entirely (user decision). Validation never rejected unknown socialCta keys, but a stored value would still leak into public output (block copied whole), so the migration strips `{socialCta,brandKitKey}` from `events.theme_overrides`.
- T2 migration: `src/database/migrations/1791035625881-RemoveBrandKits.ts` (generated FK/column drops + hand-added JSONB cleanup and `DROP TABLE "brand_kits"`; `down` recreates table/columns/FKs with original names, data not restored). User approved destructive statements; applied locally with `npm run db:run` (also applied pending data-only 1790985211804); `db:gen` afterwards reports no schema changes.
- T2 evidence: `tsc --noEmit` 65 errors (baseline 66, none in touched files except pre-existing TS2589 in `events.service.spec.ts`); `jest src/events src/theme-assets src/brands src/photos` 344/344; `npm test` 781/781 on rerun (first run 1 failure in `photos.service.spec.ts`, known flaky pagination test); grep for kit symbols only hits the new migration.
- T2 notes: removed redundant `rejects the removed brandName placeholder` test (covered by `rejects an unknown placeholder`); brands log key `brandName` renamed to `name`; error codes 46-48 retired (gap left on purpose).
- Next: T3 (front `bookandsign-front`: drop `brandKitId`, `brandKitKey`, `brandName`, `brand-kit` owner type, error codes 46-48).
