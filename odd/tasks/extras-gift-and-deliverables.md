# Extras: gift flag, product add/remove, deliverables snapshot

Objective: let staff mark a contract extra as a gift ($0), let any extra add or remove package products generically, and freeze the resulting deliverables on the contract so later catalog edits never change issued receipts.
Repos: `bookandsign-api` (this doc) + `bookandsign-front` (tasks F#). Branch: `feat/extras-gift-deliverables` in each repo. Delivery: ask-on-risk. Runner: API `npm test` (jest, real PostgreSQL); front `yarn vitest`.

## Specs

- **S1 — Gift per contract line.** User: "un check en el extra para indicar que es regalo". `ContractExtra.isGift` (default `false`). When `true`, `finalPriceSnapshot = 0` and `discountPercentageSnapshot = 100`; `basePriceSnapshot` keeps the catalog price so the gifted value stays reportable. Gift is not tied to an active promotion. A gifted extra does not consume a promotion tier position.
- **S2 — Extras add/remove products, generically.** User: "el feature se acopla a la necesidad, si de repente tenemos otro problema similar tenemos que modificar codigo [...] ¿agregar ids? remplaza? true ¿que? ids productos". New table `extra_products (extra_id, product_id, quantity, action: 'add' | 'remove')`. No business-named flags (rejected: "Reemplaza la impresión del paquete").
- **S3 — Deliverables rule.** Package deliverables = package products − products removed by its linked extras. Each extra's deliverables = its `add` products. Removing a product the package does not have is ignored. Removing is idempotent across several extras.
- **S4 — Snapshot.** User: "si el snapshot es super importante, para que no modifiquemos contratos ya guardados". At contract creation and when adding items (`POST /contracts/:id/items`), store `itemsSnapshot` (jsonb, `[{ productId, name, quantity }]`) on `ContractPackage` and `ContractExtra`. Contract responses read deliverables only from the snapshot.
- **S5 — Legacy fallback.** User: "Fallback en el código: ahorita tenemos 1 solo contrato activo por lo cual podemos parchar el error y migrarlo despues de la expo". When `itemsSnapshot` is `null`, fall back to the live catalog (`package.packageProducts.product`), as today. Backfill migration + fallback removal is out of scope (after the expo).
- **S6 — Receipt shape.** User example: "paquete brillipoint signature que incluye back con letrero led . . . staff de apoyo / extra lienzo personalizado + tira de fotos para invitado + 700 / 30 min extra de servicio $0 pesos (regalo)". Package lists its snapshot items; each extra lists its snapshot items and price; gifted extras show "Regalo" and $0.
- **S7 — Admin: extra form.** Extra create/edit gets two product multi-selects: "Incluye" (`add`) and "Reemplaza a" (`remove`), reusing the package product picker pattern.
- **S8 — Admin: create contract.** Extras table in contract creation gets a "Regalo" checkbox per row; the row total shows $0 when checked. Final price still comes from the API.
- Assumption: Glitter bar / Glam station need no code (2 packages + 2 extras at $1,000), configured from the admin after F2.

## Tasks

| ID | Repo | Specs | Route | Status | Commit |
|----|------|-------|-------|--------|--------|
| A1 | API | S2 | inline | done | 9a6f516 |
| A2 | API | S1 | inline | done | af14382 |
| A3 | API | S3, S4 | inline | done | d5f6704 |
| A4 | API | S4, S5, S6 | inline | done | 124e350 |
| F1 | front | S1, S6 | inline | done | f368ccb |
| F2 | front | S7 | inline | done | 527ee69 |
| F3 | front | S8 | inline | done | e27f37a |
| F4 | front | S5, S6 | inline | done | 3272af0 |

- **A1** — `ExtraProduct` entity + migration (bookandsign-migrations skill); `CreateExtraDto`/`UpdateExtraDto` accept `products: [{ productId, quantity, action }]`; `ExtraResponseDto` exposes them; validate products belong to the extra's brand.
- **A2** — `isGift` column + migration; `AddExtraDto.isGift?`; pricing in `contracts.service.ts` (~L421-466) zeroes the price and skips the tier counter; expose in `ContractExtraDto`.
- **A3** — Pure `resolveDeliverables(packageProducts, extras)` helper (unit-tested) + `itemsSnapshot` columns + migration; written on create and `POST :id/items`.
- **A4** — Contract detail / get-by-token: expose `itemsSnapshot` on package and extra DTOs, with S5 fallback for null. Test: editing a package's products after contracting leaves the snapshot unchanged.
- **F1** — Interfaces: `Extra.products`, `ContractExtra.isGift`, `itemsSnapshot` on contract package/extra.
- **F2** — `extras-add.tsx` / `extras-edit/[id].tsx`: "Incluye" and "Reemplaza a" multi-selects.
- **F3** — `contracts-add/components/ExtrasSection.tsx` + `useCreateContractForm`: gift checkbox, $0 row total, send `isGift`.
- **F4** — Receipt (`features/booking/components/ReservationServicesSection.tsx`, `ReservationExtrasSection.tsx`): render snapshot items (fallback to current list when null), extra sub-items, "🎁 Regalo $0".

Order: A1 → A2 → A3 → A4, then F1 → F2 → F3 → F4. F2 needs A1; F3 needs A2; F4 needs A4.
Risk: item 1 (three migrations, all additive; no data rewritten) and item 3 (contract response DTOs gain fields; additive). Out of scope: `expo-bebe` ExtrasSection, backfill migration.

## Log

- L1 (2026-10-19, user): "en la funcionalidad de promociones, actualmente tenemos descuentos por costo y por extras, quisiera extender este ultimo para al agregar 1 extra los otros extras no tengan costo / o mas bien, un check en el extra para indicar que es regalo"
- L2: Existing extra promo is order-based (Nth extra linked to a package gets tier N %, `contracts.service.ts:438-453`), so it cannot choose which extra is free → per-line gift flag.
- L3: Contract detail reads package products live (`contracts.service.ts:729`); no product snapshot exists today → S4/S5.
- L4 (2026-10-19, user): plan first, before code: "Primero arma el plan de tareas para API y front antes de escribir código".
- L5 (2026-10-19, user): "vamos a ejecutarlo, pero genera branches en back y en front, genera los commits por cada linea tarea pero no mergemos a dev ni push, quisiera probarlo antes de cualquier liberacion". Branch `feat/extras-gift-deliverables` in both repos; nothing pushed or merged.
- L6: Contract responses expose the resolved list as `deliverables` (snapshot, or catalog fallback per S5) instead of the raw `itemsSnapshot` column. `POST /contracts/:id/items` is a stub (`addItem` logs only), so snapshots are written on contract creation only.
- L7 evidence: API full suite 818/818 green (jest, real PostgreSQL); 3 migrations generated, gate passed (additive only), applied to local dev DB, `db:gen` converges. Front: 603/604; the one failure is `partnersRepository.test.ts` (copy text mismatch), pre-existing — branch touches no partners file. Front has no ESLint config; pre-existing files were not prettier-clean, so only new files were formatted.
- L8 incidents fixed before final commits: a folder-wide prettier run reformatted 18 unrelated API files (A2 commit redone); a Python edit turned CRLF into LF in `ReservationServicesSection.tsx` (F4 amended back to CRLF).
- L9 open decision: in contracts-add, with a single package in the cart the extras picker sends `packageClientRef = null` (existing tested behavior), so a "Reemplaza a" extra does not remove products from that package and promotion tiers do not apply either. Linking automatically would also start applying tier discounts.

