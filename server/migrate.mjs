import { migrate, getPool } from './db.mjs';

try {
  await migrate();
  console.log('migrated');
} catch (err) {
  console.error('migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await getPool().end().catch(() => {});
}
