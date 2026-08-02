import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    const val = m[2].replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Не задан DATABASE_URL. Скопируй .env.example в .env и укажи строку подключения.');
  process.exit(1);
}

export const pool = new pg.Pool({ connectionString });
export const REPO_ROOT = path.join(__dirname, '..');
export const DATA_DIR = path.join(REPO_ROOT, 'data_pack');
