# Feature: theme-brand-kits

**Status**: IMPLEMENTED — all tasks done 2026-09-27; push/PR pending user decision.
**Branch**: `feat/theme-brand-kits` (from `main`).
**Engram mirror**: topic `odd/theme-brand-kits/tasks`.
**Sibling feature**: `odd/partner-events/tasks` (depends on T3).
**Scope**: backend only (frontend is a separate repo).

## Objective
Allow highly customized event galleries (corporate activations, premium events) without forking base themes, by layering partial customizations over decoration-based presets.

## Problem / Why
`EventTheme` (`src/events/entities/event-themes.entity.ts`) holds full `tokens` and a free-form `images` map; each event points to one theme. One-off customizations (the "Steven" icon) forced edits to base themes; `events.decorative_icon` was a patch. The social CTA is hardcoded in ~6 places in the frontend.

## Design
### Layers (merged at read time; resolved theme is not stored)
```
SystemDefault (code, full) → event_themes preset (partial) → brand_kits (partial) → events.theme_overrides (partial) = resolved theme
```
- **SystemDefault**: full theme in code, typed so missing tokens fail compilation; exported as `system-default.json` with `version` for the frontend offline fallback. Neutral values only; socialCta uses i18n keys only.
- **Presets** (`event_themes`): existing themes become partial; add one neutral preset for companies.
- **brand_kits**: new table (do NOT reuse `brands`). `brands.brand_kit_id` = default kit per business brand. `events.brand_kit_id` nullable (client kit). Brillipoint kit seeded with fixed `key = 'brillipoint'`, delete-protected.
- **events.theme_overrides** jsonb: per-event tweaks.
- Brand kits and overrides share one shape: `ThemeOverrides` (all optional): partial tokens, typed image slots, decorations, socialCta, copy.
- Past galleries updating when a preset/kit changes is accepted.

### Merge rules
- absent/undefined → inherit; `null` → explicitly remove; arrays → replace (never concat).
- Tokens are always complete after merge; images and socialCta may be absent.

### Typed image slots
`logo`, `splashIcon`, `hero`, `watermark`, `background`, `cover`. `cover` = `{ path, url, alt?: {es?, en?}, link? }`, fixed aspect ratio (4:5).

### socialCta
Whole-block fallback (never per network). Event kit → contract brand kit → Brillipoint kit (`key = 'brillipoint'`) → `null`. `primaryAction.channel` not repeated in `socials`; empty socials omitted; URLs validated on save. Texts: `{ key, params }` (frontend interpolates) or `{ text: { es, en } }`.

### Public endpoint
`EventThemeService.getPublicThemeByEventToken` resolves the chain; response stays `{ eventTheme }`.

## Decisions (2026-09-27, risk review with user)
- R1 `decorative_icon`: user confirms no events use it → drop column in T4. Migration still copies any non-null values into `theme_overrides` before DROP (no-op if empty). Safe for v1 API: `forbidNonWhitelisted: false` (`src/main.ts:22`) means clients still sending `decorativeIcon` are not rejected. Remove the field from v1 DTOs.
- R1b (2026-09-27): user confirms events that used decorative_icon are no longer in use; losing the icon in their galleries is accepted.
- R2 image slots: no theme images exist in prod → typed slots adopted as designed, no alias for legacy keys.
- R3 fallback brand: Brillipoint is the default when `contracts.brand_id` is null or the brand has no kit; looked up by `brand_kits.key = 'brillipoint'` (`brands` has no key/slug column).
- R4 event without theme: resolve to SystemDefault instead of 404 (behavior change accepted).
- R6 templates (2026-09-27): placeholder format is `{{key}}` (replaces `{brandName}` in the handoff). Frontend interpolates with `translate(template, params)`; missing/null params render as ''. Backend only stores texts and (T7) rejects unknown placeholder keys.
- R7 WhatsApp primaryAction stores `phone` + `message: ThemeText` (not a prebuilt URL) so the frontend can interpolate then build `https://wa.me/<phone>?text=<encoded>`. Brillipoint: phone `5212215775211`, message es "Hola, te vi en la fiesta de {{honoreesName}} y me gustaría esto para mi fiesta"; socials instagram https://www.instagram.com/brillipoint, tiktok https://www.tiktok.com/@brillipoint.glitterbar, facebook https://www.facebook.com/profile.php?id=61579380963496. T6: API exposes per-event params (`honoreesName`, `brandName`) and a fallback text when a param is missing.
- R5 cache: `Cache-Control: public, max-age=300, stale-while-revalidate=2592000`. ETag stays a hash of the response body (covers SystemDefault code changes); no max-updatedAt ETag.

## Tasks
- [x] T1 SystemDefault in code + `ThemeOverrides` type + pure merge function (inherit / null / arrays) — unit tests first
- [x] T2 Presets accept partial tokens (CreateEventThemeDto + validation); existing full presets remain valid
- [x] T3 `brand_kits` entity/migration + `brands.brand_kit_id` + Brillipoint kit seed (`key='brillipoint'`, es/en content, whatsapp primary, IG/TikTok/FB)
- [x] T4 `events.brand_kit_id` + `events.theme_overrides` jsonb; copy `decorative_icon` → overrides, drop column, remove from v1 DTOs (destructive gate)
- [x] T5 Public endpoint resolves SystemDefault→preset→kit→overrides; no-theme → SystemDefault; cache 5 min + SWR; body-hash ETag
- [x] T6 socialCta resolution (whole-block fallback incl. Brillipoint default, `{key}`/`{text}`, primaryAction dedupe) + `cover` slot
- [x] T7 Validations (URLs, minimum contrast primary/onPrimary on kits/overrides) + export `system-default.json`

## Constraints / Checks
- Strict TDD: RED → GREEN → REFACTOR. Source: user global config ("Strict TDD Mode: enabled"). Runner: `npm test` (`NODE_ENV=test jest --config jest.config.ts`, real PostgreSQL, serial). Skill: `bookandsign-testing`.
- Migrations via `bookandsign-migrations` skill (T3, T4).
- One Conventional Commit per task, no AI attribution (user rule). Record SHA per task.
- RDD: off (global) → no native review; ordinary checks only.
- Delivery: `single-pr` (user choice 2026-09-27): one branch `feat/theme-brand-kits`, one commit per task, one PR at the end. Push/PR/merge are user decisions.
- Never `git stash` to compare.

## Risks (remaining)
- Brand colors breaking contrast → validate on save (T7).
- DB-editable copy bypasses PR review → admin preview (phase 2).
- SystemDefault drift back/front → `version` + check.

## Progress
| Task | Route | Commit | Checks |
|------|-------|--------|--------|
| T1 | delegated writer (4 new files: types, default, merge, spec) + parent inline fix | 8ea6947 | RED 12/12 fail on stub → GREEN; parent RED 2 fail → GREEN; `jest src/events` 122/122; eslint ok; tsc: no errors in src/events/theme (pre-existing errors elsewhere) |
| T2 | direct inline (DTO + entity type + service one-liner, mechanical) | 7671386 | RED 1 fail (partial preset rejected) + 1 fail (public tokens incomplete) → GREEN; `jest src/events` 126/126; tsc no new errors in src/events (pre-existing analytics spec error); prettier warnings in entity/service pre-existing, untouched |
| T3 | delegated writer (entity, module, service, migration, factory, types) | b02c5a6 | RED 5 fail on stub → GREEN; jest brand-kits+brands+events 137/137; db:run/db:status ok, revert+run round-trip ok, db:gen no drift; destructive gate passed; eslint ok |
| T4 | delegated writer (entity, DTOs, service, migration, bruno docs) | d185003 | RED: brandKitId guard removed → raw FK error instead of NotFound → GREEN; jest events+brand-kits+brands+database 154/154; dev DB: 3 events had decorative_icon (ring, cake, cake) → copied to theme_overrides; revert round trip lossless; db:gen no drift; destructive gate approved via R1 |
| T5 | delegated writer (service, DTOs, entity, controller header, factory, spec migrated to real DB) | 4a74235 | RED 25 fail → GREEN; jest events+brand-kits+brands 147/147; tsc no new errors; eslint clean (1 pre-existing-style warning) |
| T6 | delegated writer (2 pure helpers + specs, service wiring, DTO, seed-update migration) | 64cdb7a | RED 11+10 fail on stubs, 8/22 service cases fail pre-T6 → GREEN; jest events+brand-kits+brands 182/182; migration up/revert/up ok, db:gen no drift; tsc no new errors; eslint clean |
| T7 | delegated writer (validator, contrast helper, decorators, export script, drift test) + parent fix for T4 regression in photos spec (57070c9) | 224a940 | RED 41 fail on stubs, 2 DTO fail w/o decorators, drift fail w/o JSON → GREEN; full `pnpm test` 46 suites 699/699; `pnpm run build` ok |

T2 notes: new `PresetThemeTokensDto` (PartialType of EventThemeTokensDto) for create/list DTOs and entity; public endpoint already resolves tokens via `resolveTheme` (partial preset → complete tokens). Open for T5: legacy `images` free map (`ThemeImageAssetDto`, alt string, mime) differs from T1 typed slots (alt {es,en}); `createEventTheme` does not persist `images` at all today.

T7 notes: `validate-theme-overrides.ts` (`@IsThemeOverrides` on UpdateEventDto, `@IsTokenContrastValid` on CreateEventThemeDto), `contrast-ratio.ts` (min 3.0, chosen so strong brand reds on white pass). `system-default.json` regenerated with `pnpm run theme:export-default`; drift test fails if code and JSON diverge. Regression found: T4 added BrandKitsService to EventsService and broke `photos.service.spec.ts` DI (14 failures) — fixed in 57070c9. e2e suites (`test:e2e`) not run.

T6 notes: `resolve-social-cta.ts` + `apply-template-fallback.ts` in `src/events/theme/`. Response adds `eventTheme.params` ({honoreesName?, brandName?}, always present). ThemeText gains `fallback?` (backend-only, stripped from response); backend never interpolates. socialCta chain independent from visual kit layer → Brillipoint kit fetched on every request (perf follow-up). Brillipoint message fallback added by migration 1790565584659; `brillipoint-kit.seed.ts` holds the final state.

T5 notes: no preset → `id: null, key: 'system-default', name: 'System Default'`. `version` = `${SYSTEM_DEFAULT_THEME_VERSION}:${max updatedAt}` over preset, kit and event (event.updatedAt always counts, so any event edit changes version/ETag — acceptable with 5-min cache). Visual kit layer: client kit ?? business brand kit ?? Brillipoint default; soft-deleted kits ignored. `event-theme.service.spec.ts` now uses real DB + `test/factories/events/event-theme.factory.ts`.

T4 notes: legacy icon preserved at `theme_overrides.decorativeIcon` (dedicated field in ThemeOverrides, not resolved nor exposed). Dev DB had 3 events using it; user says prod has none — if any exist in prod they lose the icon in the gallery until mapped. `brandKitId` + `themeOverrides` exposed on v1 update/response and v2 response; `themeOverrides` only `@IsObject` (deep validation T7). Unknown/soft-deleted `brandKitId` → 404 BRAND_KIT_NOT_FOUND.

T3 notes: module `src/brand-kits/`; seed constants in `brillipoint-kit.seed.ts` (migration 1790560306542). Test DB uses synchronize, so specs create the kit via `BrandKitFactory`. Kits are soft-deleted: (a) UNIQUE(key) still blocks reusing a deleted kit's key; (b) a brand may point to a soft-deleted kit (RESTRICT does not fire on soft delete) → T5/T6 resolution must treat it as no kit and fall back. `primaryAction` is now a union (whatsapp: phone+message; others: url).

T1 notes: files in `src/events/theme/`. Image slots and socialCta merge atomically; decoration blocks merge field by field (arrays replace); null on a token is ignored (tokens cannot be removed, protects against untyped jsonb). ~620 authored lines.

## Next step
User decides push + single PR `feat/theme-brand-kits` → `main`. Follow-ups: Brillipoint kit fetched on every public theme request (cache/optimize); admin panel for brand kits (phase 2); frontend `translate` helper + SocialCta component + bundling system-default.json.
