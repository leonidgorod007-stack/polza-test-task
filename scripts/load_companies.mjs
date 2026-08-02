// ============================================================
//  Задача 1: выгрузка (page_*.json) → PostgreSQL
//
//  Что делает скрипт:
//   1. применяет db/schema.sql (idempotent);
//   2. читает все page_001.json … page_020.json;
//   3. собирает все items со всех страниц;
//   4. грузит в таблицу companies батчами с дедупликацией по id
//      (ON CONFLICT (id) DO UPDATE) — повторный запуск безопасен;
//   5. печатает короткий отчёт (сколько прочитано / уникальных / загружено).
//
//  Запуск:  npm run load:companies
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { pool, DATA_DIR, REPO_ROOT } from './db.mjs';

async function main() {
  const client = await pool.connect();
  try {
    // 1. Схема
    const schema = fs.readFileSync(path.join(REPO_ROOT, 'db', 'schema.sql'), 'utf8');
    await client.query(schema);

    // 2–3. Читаем все страницы
    const files = fs.readdirSync(DATA_DIR)
      .filter(f => /^page_\d+\.json$/.test(f))
      .sort();
    if (files.length === 0) throw new Error('Не найдены файлы page_*.json в data_pack/');

    const items = [];
    let declaredTotal = null;
    for (const f of files) {
      const json = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
      declaredTotal = json.total ?? declaredTotal;
      for (const it of json.items) items.push(it);
    }
    console.log(`Прочитано страниц: ${files.length}`);
    console.log(`Собрано записей (с дублями): ${items.length}  (поле total в API = ${declaredTotal})`);

    // Дедупликация на стороне скрипта по id (в выгрузке есть повторяющиеся id).
    const byId = new Map();
    for (const it of items) byId.set(it.id, it);          // последняя запись побеждает
    const unique = [...byId.values()];
    console.log(`Уникальных id: ${unique.length}  (дублей отброшено: ${items.length - unique.length})`);

    // 4. Загрузка батчами внутри транзакции.
    //    ON CONFLICT (id) DO UPDATE → повторный запуск идемпотентен.
    await client.query('BEGIN');
    const BATCH = 200;
    let loaded = 0;
    for (let i = 0; i < unique.length; i += BATCH) {
      const chunk = unique.slice(i, i + BATCH);
      await client.query(buildInsert(chunk), flatten(chunk));
      loaded += chunk.length;
    }
    await client.query('COMMIT');

    // 5. Отчёт
    const { rows } = await client.query('SELECT count(*)::int AS n FROM companies');
    console.log(`\n✅ Загружено/обновлено записей: ${loaded}`);
    console.log(`   Всего в таблице companies: ${rows[0].n}`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Ошибка загрузки:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

// rating в выгрузке — число или null; ограничиваем 0..5 на всякий случай.
function normalizeRating(r) {
  if (r === null || r === undefined) return null;
  const n = Number(r);
  if (!Number.isFinite(n) || n < 0 || n > 5) return null;
  return n;
}

// Строим один INSERT ... VALUES для батча.
function buildInsert(chunk) {
  const values = chunk.map((_, j) => {
    const b = j * 9;
    return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},'api_pages')`;
  }).join(',');
  return `
    INSERT INTO companies
      (id, name, category, city, address, rating, reviews_count, site, phone, source)
    VALUES ${values}
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, category = EXCLUDED.category, city = EXCLUDED.city,
      address = EXCLUDED.address, rating = EXCLUDED.rating,
      reviews_count = EXCLUDED.reviews_count, site = EXCLUDED.site,
      phone = EXCLUDED.phone, updated_at = now()`;
}

function flatten(chunk) {
  const out = [];
  for (const c of chunk) {
    out.push(
      c.id, c.name, c.category ?? null, c.city ?? null, c.address ?? null,
      normalizeRating(c.rating),
      Number.isFinite(c.reviews_count) ? c.reviews_count : 0,
      c.site ?? null, c.phone ?? null,
    );
  }
  return out;
}

main();
