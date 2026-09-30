# Feature: theme-authoring

**Status**: IN PROGRESS
**Branch**: `feat/theme-authoring` (from `feat/theme-brand-kits` @ b6f72a2 — depends on the layered theme system).
**Engram mirror**: topic `odd/theme-authoring/tasks`.
**Scope**: backend only. Frontend and the authoring skill are separate.

## Objective
Let staff author and update event themes through the API during event creation ("diseño de la experiencia"), so a future interview skill can emit JSON payloads that the backend validates and persists.

## Use cases
- **Party**: pick a preset (`eventThemeId`) + `events.theme_overrides` (e.g. `images.cover`, `decorations.confetti`). socialCta falls back to Brillipoint automatically (no kit assignment needed).
- **Company**: create a `brand_kit` (name, `images.logo`, brand `tokens`, `socialCta`) and assign it with `PATCH /events/:id { brandKitId }`. Companies go to `brand_kits`, NOT `brands` (brands = business brand with products/terms).

## Constraints
- Reuse existing validation: `@IsThemeOverrides`, `@IsTokenContrastValid` (`src/events/dto/event-theme/validate-theme-overrides.ts`).
- Global auth guard: endpoints are staff-only by default (no `@Public`).
- Brillipoint kit (`key='brillipoint'`) seed is created manually by the user; it stays delete-protected.
- Strict TDD: RED → GREEN → REFACTOR. Source: user global config. Runner: `pnpm test` (real PostgreSQL). Skill: `bookandsign-testing`.
- One Conventional Commit per task, no AI attribution (user rule).
- RDD: off (global) → ordinary checks only.
- Delivery: commits only on `feat/theme-authoring` (user choice 2026-09-28); no PR slicing. Push/PR/merge are user decisions.
- Never `git stash` to compare.

## Tasks
- [x] T1 Brand kits CRUD: `POST/GET/GET :id/PATCH/DELETE /brand-kits`; DTOs validated with `ThemeOverrides` validators + contrast; `key` unique (409 on conflict); PATCH overrides semantics documented (replace vs merge); DELETE keeps Brillipoint protection
- [x] T2 `PATCH /events/themes/:id` to update a preset (partial tokens, images), same validation as create
- [x] T3 `POST /events/themes/preview` dry-run: body `{ eventThemeId?, brandKitId?, brandKit?: ThemeOverrides, themeOverrides?, honoreesName? }` → resolved theme via existing `resolveTheme` + socialCta resolution, no persistence; also validates contrast on the RESOLVED tokens (catches kit `primary` vs inherited `onPrimary`)
- [x] T3b Preview accepts `brandKitName` for the inline kit (→ `params.brandName`); 400 without inline `brandKit`
- [x] T4 Theme asset upload URLs (decisions 2026-09-28, user-approved):
  - We host images via Supabase signed upload (same design as prep-profile); external client URLs are not stored.
  - Path: `themes/{presets|brand-kits|events}/{ownerId}/{slot}/{uuid}_{fileName}`; slot ∈ logo, splashIcon, hero, watermark, background, cover.
  - Flow: create kit first (key + name) → upload → PATCH overrides. No drafts folder; inline preview kits are for colors only.
  - Extract the Supabase client/public URL into a shared `src/common/storage` service; prep-profile keeps its behavior.
  - Cover 4:5 aspect is validated in the frontend (cannot be checked at presign time).
- [x] T4c Bruno `theme-authoring/` flows (party 6 steps, company 8 steps, chained vars, asserts) — user-approved structure 2026-09-28
- [x] T4d `PATCH /events/:id` accepts `eventThemeId` (nullable → SystemDefault); gap found by T4c: preset only settable at creation today
- [x] T5 (later, separate) Authoring interview skill that emits T1/T3 payloads and validates via preview
- [ ] T6 (backlog, user request 2026-09-28) socialCta secondary actions: allow extra action buttons (whatsapp, url/website) besides `primaryAction`, so e.g. web is primary and WhatsApp still shows as a secondary button (and vice versa). Today `primaryAction` is a single object and `socials` only has instagram/tiktok/facebook, so the non-primary channel is lost. Needs backend type/validation/resolution + frontend.

## Splash rule (user, 2026-09-28; rendered by the frontend)
- `images.background` present → full-screen splash background (9:16, `object-fit: cover`), with a dark gradient so name/date stay legible; logo needs a light/negative variant or a light plate over photos.
- No background → `images.splashIcon` (logo) centered on `primary`.
- `images.cover` stays 4:5 for the card/share surfaces; it is NOT the splash background (initial choice of cover for the splash was a mistake, corrected same day).
- Company layering: `logo` + `splashIcon` on the brand kit (fallback for every event); `background` (and optional `cover`) per event in `themeOverrides`.
- Frontend gap observed on local event 16: splash renders cover as a thumbnail + logo over hardcoded blurred blobs, and honoree name color does not follow `text`.

## Acceptance criteria
- Staff can create/update a company kit and a preset, and preview the resolved theme before saving.
- Invalid colors (contrast), URLs or placeholders are rejected with 400 on create/update/preview.

## Progress
| Task | Route | Commit | Checks |
|------|-------|--------|--------|
| T1 | delegated writer (controller, 3 DTOs + specs, service, error code, bruno) | 82b876f | RED 11 fail (methods missing) → GREEN 16/16; `pnpm test -- src/brand-kits src/events src/brands` 253/253; eslint clean; tsc no errors in brand-kits; parent spot check 25/25 |

T1 notes: duplicate key check uses `withDeleted` (soft-deleted keys still block). `key` immutable (whitelist drops it). Only `@IsThemeOverrides` applied; contrast inside it checks pairs only when the SAME layer sets both sides → T3 preview must check contrast on the resolved theme.

T2 notes: preset `key` immutable; tokens/images replace. `createEventTheme` already persisted images (sibling note was stale); only DTO exposure added.

T3 notes: response `{ eventTheme, warnings }`; resolved-contrast failures are warnings, not 400. Shared resolution extracted to `buildPublicTheme`. Inline `brandKit` has no name → sentinel key `preview-brand-kit`, `brandName` absent from params (resolved in T3b).

Delivery: branch at ~1492 authored lines; user chose plain commits on the branch (no chained PRs).

T4 notes: `POST /theme-assets/upload-url` body `{ownerType: preset|brand-kit|event, ownerId, slot, fileName, mime}` → `{bucket, path, signedUrl, token, publicUrl}`; client stores `{ path, url: publicUrl }` in the slot. Mime: png/jpeg/webp everywhere, svg only on logo/splashIcon/watermark (422 otherwise). Owner missing or soft-deleted kit → 404. Own module because it reads three unrelated owners.

T4c notes: SystemDefault is always the base layer (resolveTheme), so a missing preset never breaks tokens; `event_theme_id` FK is NO ACTION (hard delete of a used preset blocked).

T5 notes: skill lives with sibling project skills in `~/.claude/skills/` (not in the repo). Default mode emits payloads + curl with placeholders; executes requests only with explicit env/credential authorization. Open: base preset keys (pink/green/blue) are not in code — skill reads `GET /events/themes` at runtime; onPrimary derivation (white vs near-black by contrast) is a heuristic.

## Next step
User tries the skill on a real case; decide whether to version the skill in the repo authoring skill (API contract now complete: brand-kits CRUD, preset PATCH, preview, upload URLs). (upload URL) and T5 (skill).
