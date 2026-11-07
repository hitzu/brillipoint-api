import { hash } from 'bcrypt';
import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { DataSource, QueryRunner } from 'typeorm';
import {
  EXCLUDED_TABLES,
  INCLUDED_TABLES,
  IncludedTable,
  SanitizationContext,
  SeedRow,
  DEV_USER_EMAIL,
  assertLocalTarget,
  buildDevUser,
  buildRowFilter,
  findUnreadableTables,
  TargetColumn,
  reconcileTableSchema,
  sanitizeRow,
} from './production-seed';

const DEFAULT_CONTRACT_LIMIT = 50;
const DEFAULT_BATCH_SIZE = 100;
const ALL_TABLES = [...INCLUDED_TABLES, ...EXCLUDED_TABLES];

interface DatabaseIdentity {
  database: string;
  host: string;
  port: number;
  user: string;
}

interface TargetConfiguration {
  dataSource: DataSource;
  host: string;
  database: string;
}

function loadEnvironment(stage: string): void {
  const envPath = path.join(process.cwd(), `.env.${stage}`);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function createSourceDataSource(): DataSource {
  const url = process.env.SEED_SOURCE_DATABASE_URL;
  if (!url) {
    throw new Error(
      'SEED_SOURCE_DATABASE_URL is required. Inject it securely; do not pass it as a CLI argument.',
    );
  }

  const ssl =
    process.env.SEED_SOURCE_SSL === 'false'
      ? false
      : { rejectUnauthorized: false };

  return new DataSource({
    type: 'postgres',
    url,
    ssl,
    logging: false,
    extra: {
      max: 1,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      ssl,
    },
  });
}

function createTargetConfiguration(stage: string): TargetConfiguration {
  const url = process.env.SUPABASE_DB_URL;
  if (url) {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    assertLocalTarget({ stage, host, database });

    return {
      host,
      database,
      dataSource: new DataSource({
        type: 'postgres',
        url,
        ssl: false,
        logging: false,
        extra: {
          max: 1,
          connectionTimeoutMillis: 2_000,
          idleTimeoutMillis: 30_000,
        },
      }),
    };
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = Number.parseInt(process.env.DB_PORT || '5432', 10);
  const database = process.env.DB_NAME || 'bookandsign_dev';
  assertLocalTarget({ stage, host, database });

  return {
    host,
    database,
    dataSource: new DataSource({
      type: 'postgres',
      host,
      port,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database,
      ssl: false,
      logging: false,
      extra: {
        max: 1,
        connectionTimeoutMillis: 2_000,
        idleTimeoutMillis: 30_000,
      },
    }),
  };
}

async function readIdentity(runner: QueryRunner): Promise<DatabaseIdentity> {
  const [identity] = await runner.query(`
    SELECT
      current_database() AS database,
      COALESCE(inet_server_addr()::text, 'local-socket') AS host,
      COALESCE(inet_server_port(), 0) AS port,
      current_user AS user
  `);
  return identity as DatabaseIdentity;
}

function assertDifferentDatabases(
  source: DatabaseIdentity,
  target: DatabaseIdentity,
): void {
  if (
    source.database === target.database &&
    source.host === target.host &&
    Number(source.port) === Number(target.port)
  ) {
    throw new Error('Source and target resolve to the same database.');
  }
}

async function confirmTarget(database: string): Promise<void> {
  if (process.env.SEED_CONFIRM_TARGET === database) {
    return;
  }

  if (!stdin.isTTY) {
    throw new Error(
      `Set SEED_CONFIRM_TARGET=${database} when running without an interactive terminal.`,
    );
  }

  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await prompt.question(
      `This will replace local data in "${database}". Type the database name to continue: `,
    );
    if (answer.trim() !== database) {
      throw new Error(
        'Target confirmation did not match; no local data was changed.',
      );
    }
  } finally {
    prompt.close();
  }
}

async function readSchema(
  runner: QueryRunner,
): Promise<Map<string, TargetColumn[]>> {
  const rows = (await runner.query(
    `
      SELECT table_name, column_name,
        is_nullable = 'YES' AS nullable,
        (column_default IS NOT NULL
          OR is_identity = 'YES'
          OR is_generated = 'ALWAYS') AS has_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name, ordinal_position
    `,
    [ALL_TABLES],
  )) as Array<{
    table_name: string;
    column_name: string;
    nullable: boolean;
    has_default: boolean;
  }>;

  const schema = new Map<string, TargetColumn[]>();
  for (const row of rows) {
    const columns = schema.get(row.table_name) ?? [];
    columns.push({
      name: row.column_name,
      nullable: row.nullable,
      hasDefault: row.has_default,
    });
    schema.set(row.table_name, columns);
  }
  return schema;
}

interface SchemaReport {
  skippedTables: Set<string>;
  defaultedColumns: Map<string, string[]>;
  fallbackColumns: Map<string, Record<string, unknown>>;
}

// information_schema hides tables the role cannot read, which makes them look
// absent; pg_class lists them regardless, so a missing grant fails loudly.
async function assertSourceReadable(source: QueryRunner): Promise<void> {
  const access = (await source.query(
    `
      SELECT c.relname AS name, has_table_privilege(c.oid, 'SELECT') AS "canSelect"
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND c.relname = ANY($1::text[])
    `,
    [[...INCLUDED_TABLES]],
  )) as Array<{ name: string; canSelect: boolean }>;

  const unreadable = findUnreadableTables(access, INCLUDED_TABLES);
  if (unreadable.length > 0) {
    throw new Error(
      `The source role cannot SELECT from existing table(s): ${unreadable.join(', ')}. Grant read access (for example GRANT pg_read_all_data TO <seed role>).`,
    );
  }
}

async function reconcileSchemas(
  source: QueryRunner,
  target: QueryRunner,
): Promise<SchemaReport> {
  const [sourceSchema, targetSchema] = await Promise.all([
    readSchema(source),
    readSchema(target),
  ]);

  const report: SchemaReport = {
    skippedTables: new Set(),
    defaultedColumns: new Map(),
    fallbackColumns: new Map(),
  };
  for (const table of ALL_TABLES) {
    const result = reconcileTableSchema(
      table,
      sourceSchema.get(table)?.map((column) => column.name),
      targetSchema.get(table),
    );
    if (result.status === 'skipped') {
      report.skippedTables.add(table);
      console.warn(
        `Warning: table "${table}" is absent from the source; it will be empty in the target.`,
      );
    } else {
      if (result.defaultedColumns.length > 0) {
        report.defaultedColumns.set(table, result.defaultedColumns);
      }
      if (result.fallbackColumns) {
        report.fallbackColumns.set(table, result.fallbackColumns);
      }
    }
  }
  return report;
}

async function selectContractIds(
  source: QueryRunner,
  limit: number,
): Promise<number[]> {
  const rows = (await source.query(
    `
      SELECT id
      FROM contracts
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC, id DESC
      LIMIT $1
    `,
    [limit],
  )) as Array<{ id: number }>;
  return rows.map((row) => Number(row.id));
}

async function selectSlotIds(
  source: QueryRunner,
  contractIds: number[],
): Promise<number[]> {
  if (contractIds.length === 0) {
    return [];
  }

  const rows = (await source.query(
    `
      SELECT DISTINCT slot_id
      FROM (
        SELECT slot_id
        FROM contracts
        WHERE id = ANY($1::int[]) AND slot_id IS NOT NULL
        UNION
        SELECT slot_id
        FROM contract_slots
        WHERE contract_id = ANY($1::int[])
      ) selected_slots
      ORDER BY slot_id
    `,
    [contractIds],
  )) as Array<{ slot_id: number }>;
  return rows.map((row) => Number(row.slot_id));
}

async function calculateDateShiftDays(
  source: QueryRunner,
  slotIds: number[],
): Promise<number> {
  if (slotIds.length === 0) {
    return 0;
  }

  const [row] = (await source.query(
    'SELECT MAX(event_date)::text AS max_date FROM slots WHERE id = ANY($1::int[])',
    [slotIds],
  )) as Array<{ max_date: string | null }>;
  if (!row.max_date) {
    return 0;
  }

  const sourceDate = new Date(`${row.max_date}T00:00:00.000Z`);
  const targetDate = new Date();
  targetDate.setUTCHours(0, 0, 0, 0);
  targetDate.setUTCDate(targetDate.getUTCDate() + 30);
  return Math.round((targetDate.getTime() - sourceDate.getTime()) / 86_400_000);
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function insertRows(
  target: QueryRunner,
  table: IncludedTable,
  rows: SeedRow[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const columns = Object.keys(rows[0]);
  const parameters: unknown[] = [];
  const values = rows.map((row) => {
    const placeholders = columns.map((column) => {
      parameters.push(row[column]);
      return `$${parameters.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });

  await target.query(
    `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES ${values.join(', ')}`,
    parameters,
  );
}

async function copyTable(
  source: QueryRunner,
  target: QueryRunner,
  table: IncludedTable,
  contractIds: number[],
  slotIds: number[],
  context: SanitizationContext,
  batchSize: number,
  fallbackColumns: Record<string, unknown> = {},
): Promise<number> {
  const filter = buildRowFilter(table, contractIds, slotIds);
  let lastId = 0;
  let copied = 0;

  while (true) {
    const lastIdParameter = filter.parameters.length + 1;
    const batchParameter = lastIdParameter + 1;
    const rows = (await source.query(
      `
        SELECT *
        FROM ${quoteIdentifier(table)}
        WHERE (${filter.sql}) AND "id" > $${lastIdParameter}
        ORDER BY "id"
        LIMIT $${batchParameter}
      `,
      [...filter.parameters, lastId, batchSize],
    )) as SeedRow[];

    if (rows.length === 0) {
      break;
    }

    await insertRows(
      target,
      table,
      rows.map((row) => ({
        ...sanitizeRow(table, row, context),
        ...fallbackColumns,
      })),
    );
    lastId = Number(rows[rows.length - 1].id);
    copied += rows.length;
  }

  return copied;
}

async function resetSequence(
  target: QueryRunner,
  table: IncludedTable,
): Promise<void> {
  await target.query(`
    SELECT setval(
      pg_get_serial_sequence('${table}', 'id'),
      COALESCE(MAX(id), 1),
      MAX(id) IS NOT NULL
    )
    FROM ${quoteIdentifier(table)}
  `);
}

async function auditTarget(target: QueryRunner): Promise<void> {
  const [themeImagesColumn] = (await target.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'event_themes'
        AND column_name = 'images'
    ) AS exists
  `)) as Array<{ exists: boolean }>;
  const themeImagesAudit = themeImagesColumn.exists
    ? '(SELECT COUNT(*) FROM event_themes WHERE images IS NOT NULL)'
    : '0';

  const [audit] = (await target.query(`
    SELECT
      (SELECT COUNT(*) FROM tokens) AS tokens,
      (SELECT COUNT(*) FROM payments) AS payments,
      (SELECT COUNT(*) FROM sessions) AS sessions,
      (SELECT COUNT(*) FROM photos) AS photos,
      (SELECT COUNT(*) FROM notes) AS notes,
      (SELECT COUNT(*) FROM event_analytics) AS analytics,
      (SELECT COUNT(*) FROM contract_preparation_profiles) AS profiles,
      (SELECT COUNT(*) FROM carousels) AS carousels,
      (SELECT COUNT(*) FROM users WHERE email IS NOT NULL AND email NOT LIKE '%@example.test') AS user_emails,
      (SELECT COUNT(*) FROM contracts WHERE client_email IS NOT NULL AND client_email NOT LIKE '%@example.test') AS client_emails,
      (SELECT COUNT(*) FROM brands WHERE email IS NOT NULL AND email NOT LIKE '%@example.test') AS brand_emails,
      (SELECT COUNT(*) FROM brands WHERE logo_url IS NOT NULL) AS brand_logos,
      ${themeImagesAudit} AS theme_images,
      (SELECT COUNT(*) FROM events WHERE service_location_url IS NOT NULL OR print_templates IS NOT NULL) AS event_external_data,
      (SELECT COUNT(*) FROM bookings WHERE venue_name IS NOT NULL OR maps_url IS NOT NULL OR title IS DISTINCT FROM 'Local Booking ' || id) AS booking_free_text
  `)) as Array<Record<string, string>>;

  const failures = Object.entries(audit)
    .filter(([, value]) => Number(value) !== 0)
    .map(([key, value]) => `${key}=${value}`);
  if (failures.length > 0) {
    throw new Error(`PII/external-data audit failed: ${failures.join(', ')}`);
  }
}

async function ensureDevUser(
  target: QueryRunner,
  passwordHash: string,
): Promise<void> {
  const user = buildDevUser(passwordHash);
  const { email, ...values } = user;
  const columns = Object.keys(values);
  const existing = (await target.query(
    'SELECT id FROM users WHERE email = $1 ORDER BY id LIMIT 1',
    [email],
  )) as Array<{ id: number }>;

  if (existing.length === 0) {
    await insertRows(target, 'users', [user]);
    return;
  }

  await target.query(
    `UPDATE users SET ${columns.map((column, index) => `${quoteIdentifier(column)} = $${index + 2}`).join(', ')} WHERE id = $1`,
    [existing[0].id, ...columns.map((column) => values[column])],
  );
}

function printHelp(): void {
  console.log(`
Usage:
  SEED_SOURCE_DATABASE_URL=<secret> \\
  SEED_LOCAL_PASSWORD=<password> \\
  pnpm db:seed:from-production

Optional environment variables:
  SEED_SOURCE_SSL=false       Disable SSL for a non-production source used in testing
  SEED_CONTRACT_LIMIT=50      Number of recent contracts to copy
  SEED_BATCH_SIZE=100         Rows inserted per batch
  SEED_CONFIRM_TARGET=<name>  Non-interactive confirmation of the local database name

The target uses the existing local SUPABASE_DB_URL or DB_* configuration.
The source may be behind the local schema: tables missing from the source are
skipped, and target-only columns must be nullable, have a default, or declare a
fallback in REQUIRED_COLUMN_POLICY. A source with columns the target lacks
still aborts.

Source role grants: SELECT on every included table (for example
GRANT pg_read_all_data TO <seed role>, PostgreSQL 14+). A table that exists but
cannot be read aborts the seed; only a table absent from the source is skipped.

The seed always leaves an admin ${DEV_USER_EMAIL} in the target, with the
password from SEED_LOCAL_PASSWORD, even when the copy fails.

Only loopback targets are accepted. Production credentials are never logged.
`);
}

export async function run(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  const stage = process.env.NODE_ENV || 'local';
  loadEnvironment(stage);

  const localPassword = process.env.SEED_LOCAL_PASSWORD;
  if (!localPassword) {
    throw new Error(
      'SEED_LOCAL_PASSWORD is required for sanitized local users.',
    );
  }

  const passwordHash = await hash(localPassword, 12);
  const contractLimit = parsePositiveInteger(
    process.env.SEED_CONTRACT_LIMIT,
    DEFAULT_CONTRACT_LIMIT,
    'SEED_CONTRACT_LIMIT',
  );
  const batchSize = parsePositiveInteger(
    process.env.SEED_BATCH_SIZE,
    DEFAULT_BATCH_SIZE,
    'SEED_BATCH_SIZE',
  );
  const source = createSourceDataSource();
  const targetConfiguration = createTargetConfiguration(stage);
  const target = targetConfiguration.dataSource;
  let sourceRunner: QueryRunner | undefined;
  let targetRunner: QueryRunner | undefined;
  let targetConfirmed = false;

  try {
    await Promise.all([source.initialize(), target.initialize()]);
    sourceRunner = source.createQueryRunner();
    targetRunner = target.createQueryRunner();
    await Promise.all([sourceRunner.connect(), targetRunner.connect()]);
    const [sourceIdentity, targetIdentity] = await Promise.all([
      readIdentity(sourceRunner),
      readIdentity(targetRunner),
    ]);
    assertDifferentDatabases(sourceIdentity, targetIdentity);
    assertLocalTarget({
      stage,
      host: targetConfiguration.host,
      database: targetIdentity.database,
    });
    await confirmTarget(targetIdentity.database);
    targetConfirmed = true;
    await assertSourceReadable(sourceRunner);
    const schemaReport = await reconcileSchemas(sourceRunner, targetRunner);

    await sourceRunner.startTransaction('REPEATABLE READ');
    await sourceRunner.query('SET TRANSACTION READ ONLY');
    const [readOnly] = (await sourceRunner.query(
      `SELECT current_setting('transaction_read_only') AS value`,
    )) as Array<{ value: string }>;
    if (readOnly.value !== 'on') {
      throw new Error('Source transaction is not read-only.');
    }

    const contractIds = await selectContractIds(sourceRunner, contractLimit);
    const slotIds = await selectSlotIds(sourceRunner, contractIds);
    const dateShiftDays = await calculateDateShiftDays(sourceRunner, slotIds);
    const context: SanitizationContext = { passwordHash, dateShiftDays };

    await targetRunner.startTransaction('SERIALIZABLE');
    await targetRunner.query(
      `TRUNCATE TABLE ${ALL_TABLES.map(quoteIdentifier).join(', ')} RESTART IDENTITY CASCADE`,
    );

    const counts = new Map<IncludedTable, number>();
    for (const table of INCLUDED_TABLES) {
      if (schemaReport.skippedTables.has(table)) {
        continue;
      }
      const count = await copyTable(
        sourceRunner,
        targetRunner,
        table,
        contractIds,
        slotIds,
        context,
        batchSize,
        schemaReport.fallbackColumns.get(table),
      );
      await resetSequence(targetRunner, table);
      counts.set(table, count);
    }

    await auditTarget(targetRunner);
    await ensureDevUser(targetRunner, passwordHash);
    await targetRunner.commitTransaction();
    await sourceRunner.rollbackTransaction();

    console.log(`Sanitized seed completed for ${targetIdentity.database}.`);
    console.log(`Selected contracts: ${contractIds.length}`);
    console.log(`Date shift: ${dateShiftDays} day(s)`);
    for (const [table, count] of counts) {
      console.log(`${table}: ${count}`);
    }
    if (schemaReport.skippedTables.size > 0) {
      console.log(
        `Skipped tables (absent in source): ${[...schemaReport.skippedTables].join(', ')}`,
      );
    }
    for (const [table, columns] of schemaReport.defaultedColumns) {
      console.log(
        `Filled by target default in ${table}: ${columns.join(', ')}`,
      );
    }
    for (const [table, columns] of schemaReport.fallbackColumns) {
      console.log(
        `Filled by seed fallback in ${table}: ${Object.keys(columns).join(', ')}`,
      );
    }
    console.log(`Dev user: ${DEV_USER_EMAIL}`);
  } catch (error) {
    if (targetRunner?.isTransactionActive) {
      await targetRunner.rollbackTransaction();
    }
    if (sourceRunner?.isTransactionActive) {
      await sourceRunner.rollbackTransaction();
    }
    if (targetConfirmed && targetRunner) {
      try {
        await ensureDevUser(targetRunner, passwordHash);
        console.error(`Dev user ${DEV_USER_EMAIL} kept despite the failure.`);
      } catch {
        // The original failure is the one worth reporting.
      }
    }
    throw error;
  } finally {
    await Promise.allSettled(
      [sourceRunner, targetRunner]
        .filter((runner): runner is QueryRunner => Boolean(runner))
        .map((runner) => runner.release()),
    );
    await Promise.allSettled(
      [source, target]
        .filter((dataSource) => dataSource.isInitialized)
        .map((dataSource) => dataSource.destroy()),
    );
  }
}

if (require.main === module) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Production seed failed: ${message}`);
    process.exitCode = 1;
  });
}
