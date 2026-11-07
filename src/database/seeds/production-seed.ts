import { createHash } from 'node:crypto';

import { USER_ROLE } from '../../users/constants/user_role.enum';

export const INCLUDED_TABLES = [
  'users',
  'brands',
  'terms',
  'products',
  'packages',
  'package_products',
  'package_terms',
  'brand_terms',
  'extras',
  'extra_products',
  'promotions',
  'promotion_packages',
  'event_types',
  'event_service_types',
  'event_phrases',
  'event_themes',
  'slots',
  'contracts',
  'contract_packages',
  'contract_extras',
  'contract_promotions',
  'contract_slots',
  'events',
  'bookings',
] as const;

export const EXCLUDED_TABLES = [
  'tokens',
  'payments',
  'sessions',
  'photos',
  'notes',
  'event_analytics',
  'contract_preparation_profiles',
  'carousels',
] as const;

export type IncludedTable = (typeof INCLUDED_TABLES)[number];
export type SeedRow = Record<string, unknown>;

/**
 * `copy`: the source must already have the column. `fallback`: the seed fills
 * the column with that value when the source is behind the local schema.
 */
export type ColumnPolicy = 'copy' | { fallback: unknown };

/**
 * Every NOT NULL column without a default of an included table. The spec
 * compares it with the entities, so a migration that adds a required column
 * cannot pass until it is classified here. Prefer a fallback for columns a
 * migration adds: production receives them later than the local schema.
 */
export const REQUIRED_COLUMN_POLICY: Record<
  IncludedTable,
  Record<string, ColumnPolicy>
> = {
  users: {
    role: 'copy',
    first_name: 'copy',
    last_name: 'copy',
    password: 'copy',
  },
  brands: { name: 'copy' },
  terms: { code: 'copy', title: 'copy', content: 'copy', scope: 'copy' },
  products: { brand_id: 'copy', name: 'copy' },
  packages: { brand_id: 'copy', name: 'copy' },
  package_products: { package_id: 'copy', product_id: 'copy' },
  package_terms: { package_id: 'copy', term_id: 'copy' },
  brand_terms: { brand_id: 'copy', term_id: 'copy' },
  extras: { brand_id: 'copy', name: 'copy' },
  extra_products: { extra_id: 'copy', product_id: 'copy', action: 'copy' },
  promotions: { brand_id: 'copy', name: 'copy', type: 'copy', value: 'copy' },
  promotion_packages: {
    promotion_id: 'copy',
    package_id: 'copy',
    tier_order: { fallback: 1 },
    discount_percentage: { fallback: 0 },
  },
  event_types: { name: 'copy' },
  event_service_types: { name: 'copy' },
  event_phrases: { event_type_id: 'copy', content: 'copy' },
  event_themes: { key: 'copy', name: 'copy' },
  slots: { event_date: 'copy', period: 'copy' },
  contracts: { user_id: 'copy', sku: 'copy', token: 'copy' },
  contract_packages: {
    contract_id: 'copy',
    package_id: 'copy',
    name_snapshot: 'copy',
    base_price_snapshot: 'copy',
  },
  contract_extras: {
    contract_id: 'copy',
    extra_id: 'copy',
    name_snapshot: 'copy',
    base_price_snapshot: 'copy',
  },
  contract_promotions: {
    contract_id: 'copy',
    name_snapshot: 'copy',
    type_snapshot: 'copy',
    value_snapshot: 'copy',
    applied_amount: 'copy',
  },
  contract_slots: { contract_id: 'copy', slot_id: 'copy' },
  events: { key: 'copy', token: 'copy', contract_id: 'copy' },
  bookings: {
    event_date: 'copy',
    service_starts_at: 'copy',
    service_ends_at: 'copy',
  },
};

export const DEV_USER_EMAIL = 'dev@brillipoint.test';

/** Fixed admin so a seeded worktree can always be logged into. */
export function buildDevUser(passwordHash: string): SeedRow {
  return {
    role: USER_ROLE.ADMIN,
    first_name: 'Dev',
    last_name: 'Admin',
    email: DEV_USER_EMAIL,
    password: passwordHash,
  };
}

export interface SourceTableAccess {
  name: string;
  canSelect: boolean;
}

/** Tables that exist in the source but the seed role cannot read. */
export function findUnreadableTables(
  access: SourceTableAccess[],
  tables: readonly string[],
): string[] {
  const included = new Set(tables);
  return access
    .filter((table) => included.has(table.name) && !table.canSelect)
    .map((table) => table.name)
    .sort();
}

export interface SanitizationContext {
  passwordHash: string;
  dateShiftDays: number;
}

export interface LocalTarget {
  stage: string;
  host: string;
  database: string;
}

export interface RowFilter {
  sql: string;
  parameters: unknown[];
}

export interface SchemaColumnDiff {
  sourceOnly: string[];
  targetOnly: string[];
}

const CONTRACT_CHILD_TABLES = new Set<IncludedTable>([
  'contract_packages',
  'contract_extras',
  'contract_promotions',
  'contract_slots',
  'events',
]);

function nullableReplacement(current: unknown, replacement: unknown): unknown {
  return current === null || current === undefined ? null : replacement;
}

function deterministicUuid(namespace: string, id: unknown): string {
  const hex = createHash('sha256')
    .update(`bookandsign-local-seed:${namespace}:${String(id)}`)
    .digest('hex')
    .slice(0, 32)
    .split('');

  hex[12] = '4';
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);

  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function fakePhone(id: unknown): string {
  const numericId = Math.abs(Number(id) || 0) % 10_000_000;
  return `+1555${numericId.toString().padStart(7, '0')}`;
}

function shiftTimestamp(value: unknown, days: number): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  const shifted = new Date(value as string | number | Date);
  if (Number.isNaN(shifted.getTime())) {
    throw new Error(`Cannot shift invalid timestamp: ${String(value)}`);
  }
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
}

function shiftDate(value: unknown, days: number): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  let shifted: Date;
  if (value instanceof Date) {
    shifted = new Date(
      Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()),
    );
  } else {
    const dateOnly = String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    shifted = new Date(`${dateOnly ?? ''}T00:00:00.000Z`);
  }

  if (Number.isNaN(shifted.getTime())) {
    throw new Error(`Cannot shift invalid date: ${String(value)}`);
  }
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function sanitizeRow(
  table: IncludedTable,
  row: SeedRow,
  context: SanitizationContext,
): SeedRow {
  const id = row.id;

  switch (table) {
    case 'users':
      return {
        ...row,
        first_name: 'Local',
        last_name: `User ${String(id)}`,
        email: nullableReplacement(
          row.email,
          `user-${String(id)}@example.test`,
        ),
        phone: nullableReplacement(row.phone, fakePhone(id)),
        password: context.passwordHash,
      };
    case 'brands':
      return {
        ...row,
        logo_url: null,
        email: nullableReplacement(
          row.email,
          `brand-${String(id)}@example.test`,
        ),
        phone_number: nullableReplacement(row.phone_number, fakePhone(id)),
      };
    case 'contracts':
      return {
        ...row,
        client_name: nullableReplacement(
          row.client_name,
          `Local Client ${String(id)}`,
        ),
        client_phone: nullableReplacement(row.client_phone, fakePhone(id)),
        client_email: nullableReplacement(
          row.client_email,
          `client-${String(id)}@example.test`,
        ),
        sku: `LOCAL-${String(id)}`,
        token: deterministicUuid('contract', id),
      };
    case 'event_themes':
      return 'images' in row ? { ...row, images: null } : { ...row };
    case 'slots':
      return {
        ...row,
        event_date: shiftDate(row.event_date, context.dateShiftDays),
      };
    case 'events':
      return {
        ...row,
        key: `local-event-${String(id)}`,
        token: deterministicUuid('event', id),
        honorees_names: nullableReplacement(
          row.honorees_names,
          `Local Honorees ${String(id)}`,
        ),
        album_phrase: null,
        venue_name: nullableReplacement(
          row.venue_name,
          `Local Venue ${String(id)}`,
        ),
        service_location_url: null,
        service_starts_at: shiftTimestamp(
          row.service_starts_at,
          context.dateShiftDays,
        ),
        service_ends_at: shiftTimestamp(
          row.service_ends_at,
          context.dateShiftDays,
        ),
        delegate_name: nullableReplacement(
          row.delegate_name,
          `Local Delegate ${String(id)}`,
        ),
        print_templates: null,
      };
    case 'bookings':
      return {
        ...row,
        title: `Local Booking ${String(id)}`,
        venue_name: null,
        maps_url: null,
        event_date: shiftDate(row.event_date, context.dateShiftDays),
        service_starts_at: shiftTimestamp(
          row.service_starts_at,
          context.dateShiftDays,
        ),
        service_ends_at: shiftTimestamp(
          row.service_ends_at,
          context.dateShiftDays,
        ),
      };
    default:
      return { ...row };
  }
}

export function buildRowFilter(
  table: IncludedTable,
  contractIds: number[],
  slotIds: number[],
): RowFilter {
  if (table === 'contracts') {
    return {
      sql: '"id" = ANY($1::int[])',
      parameters: [contractIds],
    };
  }

  if (CONTRACT_CHILD_TABLES.has(table)) {
    return {
      sql: '"contract_id" = ANY($1::int[])',
      parameters: [contractIds],
    };
  }

  // Private events have no contract, so they are copied whole; bookings of
  // contracts outside the sample are skipped to keep the contract FK valid.
  if (table === 'bookings') {
    return {
      sql: '("contract_id" = ANY($1::int[]) OR "contract_id" IS NULL)',
      parameters: [contractIds],
    };
  }

  if (table === 'slots') {
    return {
      sql: '"id" = ANY($1::int[])',
      parameters: [slotIds],
    };
  }

  return { sql: 'TRUE', parameters: [] };
}

export function compareSchemaColumns(
  sourceColumns: string[],
  targetColumns: string[],
): SchemaColumnDiff {
  const source = new Set(sourceColumns);
  const target = new Set(targetColumns);

  return {
    sourceOnly: [...source].filter((column) => !target.has(column)).sort(),
    targetOnly: [...target].filter((column) => !source.has(column)).sort(),
  };
}

export interface TargetColumn {
  name: string;
  nullable: boolean;
  hasDefault: boolean;
  json?: boolean;
}

/**
 * The driver hands json columns back already parsed, and would send a parsed
 * array as a SQL array on insert. Serializing them keeps the value as json.
 */
export function serializeJsonColumns(
  row: SeedRow,
  jsonColumns: ReadonlySet<string>,
): SeedRow {
  return Object.fromEntries(
    Object.entries(row).map(([column, value]) => [
      column,
      jsonColumns.has(column) && value !== null && value !== undefined
        ? JSON.stringify(value)
        : value,
    ]),
  );
}

export type TableReconciliation =
  | { status: 'skipped' }
  | {
      status: 'copy';
      defaultedColumns: string[];
      fallbackColumns?: Record<string, unknown>;
    };

export function reconcileTableSchema(
  table: string,
  sourceColumns: string[] | undefined,
  targetColumns: TargetColumn[] | undefined,
  policy: Record<string, Record<string, ColumnPolicy>> = REQUIRED_COLUMN_POLICY,
): TableReconciliation {
  if (!targetColumns) {
    throw new Error(
      `Table "${table}" is missing from target schema. Run migrations first.`,
    );
  }
  if (!sourceColumns) {
    return { status: 'skipped' };
  }

  const difference = compareSchemaColumns(
    sourceColumns,
    targetColumns.map((column) => column.name),
  );
  if (difference.sourceOnly.length > 0) {
    throw new Error(
      `Source has columns the target lacks for "${table}". Source-only: [${difference.sourceOnly.join(', ')}]. Run the same migrations as the source on the target.`,
    );
  }

  const targetOnly = new Set(difference.targetOnly);
  const required = targetColumns.filter(
    (column) =>
      targetOnly.has(column.name) && !column.nullable && !column.hasDefault,
  );
  const fallbackColumns: Record<string, unknown> = {};
  const missing = required.filter((column) => {
    const columnPolicy = policy[table]?.[column.name];
    if (typeof columnPolicy === 'object') {
      fallbackColumns[column.name] = columnPolicy.fallback;
      return false;
    }
    return true;
  });
  if (missing.length > 0) {
    throw new Error(
      `Target-only column ${missing.map((column) => `"${table}"."${column.name}"`).join(', ')} is NOT NULL without a default, so it cannot be left unset. Declare a fallback for it in REQUIRED_COLUMN_POLICY (production-seed.ts).`,
    );
  }

  return {
    status: 'copy',
    defaultedColumns: difference.targetOnly,
    ...(Object.keys(fallbackColumns).length > 0 && { fallbackColumns }),
  };
}

export function assertLocalTarget(target: LocalTarget): void {
  if (['production', 'prod'].includes(target.stage.toLowerCase())) {
    throw new Error(
      'The production seed cannot run with a production NODE_ENV.',
    );
  }

  const host = target.host.replace(/^\[|\]$/g, '').toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error(
      `Target host must be a loopback address, received: ${host}`,
    );
  }

  if (/(^|[_-])(prod|production)([_-]|$)/i.test(target.database)) {
    throw new Error(
      `Refusing to seed a production-like database: ${target.database}`,
    );
  }
}
