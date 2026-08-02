import { Pool } from 'pg';

// Единый пул подключений на процесс. В dev-режиме Next.js перезагружает
// модули (HMR), поэтому кэшируем пул в globalThis, чтобы не плодить
// подключения при каждой пересборке.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

if (!process.env.DATABASE_URL) {
  throw new Error('Не задан DATABASE_URL. Скопируй web/.env.example → web/.env и укажи строку подключения.');
}

export const pool =
  globalForPg.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = pool;
