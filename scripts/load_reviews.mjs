// ============================================================
//  Задача 3: review.csv → PostgreSQL + отчёт по данным
//
//  Стратегия:
//   1. Грузим CSV "как есть" в staging-таблицу reviews_raw (все колонки TEXT),
//      чтобы битые значения не рушили импорт.
//   2. Считаем короткий отчёт по данным и перечень аномалий
//      (то же, что зафиксировано в ANOMALIES.md).
//   3. Аккуратно мёржим в companies только валидные НОВЫЕ записи
//      (валидный id, которого ещё нет в базе), с чисткой полей.
//      Всё сомнительное — пропускаем и объясняем почему.
//
//  Запуск:  npm run load:reviews
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { pool, DATA_DIR, REPO_ROOT } from './db.mjs';
import { parseCSV } from './csv.mjs';

const ID_RE = /^c_\d{6}$/;
const PHONE_RE = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;
const SITE_RE = /^https?:\/\/[^\s]+\.[^\s]+$/;

function parseRating(v) {
  if (v == null || v.trim() === '') return { ok: true, value: null };
  const t = v.trim().replace(',', '.');          // "4,5" → "4.5"
  if (!/^-?\d+(\.\d+)?$/.test(t)) return { ok: false, value: null };
  const n = Number(t);
  if (n < 0 || n > 5) return { ok: false, value: null };
  return { ok: true, value: n };
}
function parseReviews(v) {
  if (v == null || v.trim() === '') return { ok: true, value: 0 };
  const t = v.trim();
  if (!/^-?\d+$/.test(t)) return { ok: false, value: null }; // "45.5", "много"
  const n = parseInt(t, 10);
  if (n < 0) return { ok: false, value: null };
  return { ok: true, value: n };
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query(fs.readFileSync(path.join(REPO_ROOT, 'db', 'schema.sql'), 'utf8'));

    // 1. Загрузка сырья в reviews_raw
    const raw = fs.readFileSync(path.join(DATA_DIR, 'review.csv'), 'utf8');
    const rows = parseCSV(raw);
    const header = rows[0].map(h => h.trim());
    const col = Object.fromEntries(header.map((h, i) => [h, i]));
    const dataRows = rows.slice(1);

    await client.query('BEGIN');
    await client.query('TRUNCATE reviews_raw');
    const recs = [];
    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      const rec = {
        line_no: i + 2, // +1 за 0-индекс, +1 за строку заголовка
        id: r[col.id] ?? '', name: r[col.name] ?? '', category: r[col.category] ?? '',
        city: r[col.city] ?? '', address: r[col.address] ?? '', rating: r[col.rating] ?? '',
        reviews_count: r[col.reviews_count] ?? '', site: r[col.site] ?? '', phone: r[col.phone] ?? '',
      };
      recs.push(rec);
      await client.query(
        `INSERT INTO reviews_raw (line_no,id,name,category,city,address,rating,reviews_count,site,phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [rec.line_no, rec.id, rec.name, rec.category, rec.city, rec.address, rec.rating, rec.reviews_count, rec.site, rec.phone]
      );
    }
    await client.query('COMMIT');

    // 2. Отчёт по данным
    const { rows: baseRows } = await client.query('SELECT id FROM companies');
    const baseIds = new Set(baseRows.map(r => r.id));

    const nonEmpty = recs.filter(r => Object.values(r).some((v, i) => i > 0 && String(v).trim() !== ''));
    const emptyRows = recs.length - nonEmpty.length;
    const idCount = new Map();
    nonEmpty.forEach(r => idCount.set(r.id, (idCount.get(r.id) || 0) + 1));
    const dupIds = [...idCount].filter(([, n]) => n > 1);
    const badIdRows = nonEmpty.filter(r => !ID_RE.test(r.id));
    const overlap = nonEmpty.filter(r => ID_RE.test(r.id) && baseIds.has(r.id));

    const ratingBad = nonEmpty.filter(r => !parseRating(r.rating).ok);
    const reviewsBad = nonEmpty.filter(r => !parseReviews(r.reviews_count).ok);
    const phoneBad = nonEmpty.filter(r => r.phone.trim() !== '' && !PHONE_RE.test(r.phone.trim()));
    const siteBad = nonEmpty.filter(r => r.site.trim() !== '' && !SITE_RE.test(r.site.trim()));
    const wsRows = nonEmpty.filter(r => Object.entries(r).some(([k, v]) => k !== 'line_no' && typeof v === 'string' && v !== v.trim()));

    const rpt = [];
    rpt.push('════════════════ ОТЧЁТ ПО review.csv ════════════════');
    rpt.push(`Строк данных всего:              ${recs.length}`);
    rpt.push(`  из них полностью пустых:       ${emptyRows}`);
    rpt.push(`  содержательных строк:          ${nonEmpty.length}`);
    rpt.push(`Уникальных id (среди непустых):  ${idCount.size}`);
    rpt.push(`Дубликаты id внутри файла:       ${dupIds.length}  [${dupIds.map(([id, n]) => `${id}×${n}`).join(', ')}]`);
    rpt.push(`Строки с битым id (не c_NNNNNN):  ${badIdRows.length}`);
    rpt.push(`id, уже существующие в базе:      ${overlap.length}  [${overlap.map(r => r.id).join(', ')}]`);
    rpt.push('--- битые значения полей ---');
    rpt.push(`rating некорректный/вне 0..5:     ${ratingBad.length}  [${ratingBad.map(r => `${r.id}:"${r.rating}"`).join(', ')}]`);
    rpt.push(`reviews_count не целое/отриц.:    ${reviewsBad.length}  [${reviewsBad.map(r => `${r.id}:"${r.reviews_count}"`).join(', ')}]`);
    rpt.push(`phone не по маске:                ${phoneBad.length}  [${phoneBad.map(r => `${r.id}:"${r.phone}"`).join(', ')}]`);
    rpt.push(`site не валидный URL:             ${siteBad.length}  [${siteBad.map(r => `${r.id}:"${r.site}"`).join(', ')}]`);
    rpt.push(`лишние пробелы в значениях:       ${wsRows.length}  [${wsRows.map(r => r.id).join(', ')}]`);
    rpt.push('═════════════════════════════════════════════════════');
    console.log(rpt.join('\n'));

    // 3. Мёрж валидных НОВЫХ записей в companies
    //    Правила: валидный id, которого нет в базе, не пустой, не дубль внутри файла;
    //    битые rating/reviews_count/site/phone → NULL (запись всё равно грузим,
    //    но с очищенными полями). Дубли внутри файла берём один раз.
    await client.query('BEGIN');
    const seen = new Set();
    let merged = 0, skippedExisting = 0, skippedBadId = 0, skippedDup = 0, cleanedFields = 0;
    for (const r of nonEmpty) {
      if (!ID_RE.test(r.id)) { skippedBadId++; continue; }
      if (baseIds.has(r.id)) { skippedExisting++; continue; }
      if (seen.has(r.id)) { skippedDup++; continue; }
      seen.add(r.id);

      const rt = parseRating(r.rating);
      const rc = parseReviews(r.reviews_count);
      // Невалидные телефон/сайт превращаем в NULL (в базе не место "нет сайта" или "8 (925) abc-...").
      const phone = PHONE_RE.test(r.phone.trim()) ? r.phone.trim() : null;
      const site = SITE_RE.test(r.site.trim()) ? r.site.trim() : null;
      if (!rt.ok || !rc.ok || (r.phone.trim() && !phone) || (r.site.trim() && !site)) cleanedFields++;

      await client.query(
        `INSERT INTO companies (id,name,category,city,address,rating,reviews_count,site,phone,source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'review_csv')
         ON CONFLICT (id) DO NOTHING`,
        [r.id, r.name.trim(), r.category.trim() || null, r.city.trim() || null,
         r.address.trim() || null, rt.value, rc.value ?? 0, site, phone]
      );
      merged++;
    }
    await client.query('COMMIT');

    console.log('\n──────────── МЁРЖ в companies ────────────');
    console.log(`Добавлено новых компаний:        ${merged}`);
    console.log(`  из них с очищенными полями:     ${cleanedFields} (битые значения → NULL)`);
    console.log(`Пропущено (уже в базе):          ${skippedExisting}`);
    console.log(`Пропущено (битый id):            ${skippedBadId}`);
    console.log(`Пропущено (дубль id в файле):    ${skippedDup}`);
    const { rows: tot } = await client.query('SELECT count(*)::int n FROM companies');
    console.log(`Итого в companies:               ${tot[0].n}`);
    console.log('\nПодробности аномалий — в ANOMALIES.md');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Ошибка:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
