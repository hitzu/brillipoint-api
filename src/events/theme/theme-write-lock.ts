import type { EntityManager } from 'typeorm';

/** A single coarse lock serializes all writes that can affect public themes. */
export const THEME_WRITE_LOCK_KEY = 1_947_326_501;

/**
 * Run a public-theme-sensitive mutation in a transaction after taking the
 * shared PostgreSQL transaction-scoped lock. Keep this helper dependency-free
 * so event and theme modules can coordinate without importing each other.
 */
export function withThemeWriteLock<T>(
  manager: EntityManager,
  write: (transactionManager: EntityManager) => Promise<T>,
): Promise<T> {
  return manager.transaction(async (transactionManager) => {
    await transactionManager.query('SELECT pg_advisory_xact_lock($1)', [
      THEME_WRITE_LOCK_KEY,
    ]);
    return write(transactionManager);
  });
}
