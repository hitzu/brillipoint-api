import { createHash } from 'node:crypto';

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
