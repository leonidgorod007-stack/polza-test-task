import { Pool } from 'pg';

const globalForPg = globalThis as unknown as { pgPool?: Pool };

if (!process.env.DATABASE_URL) {
  throw new Error('Не задан DATABASE_URL. Скопируй web/.env.example в web/.env и укажи строку подключения.');
}

export const pool =
  globalForPg.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = pool;
