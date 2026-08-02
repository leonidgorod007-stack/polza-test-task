import { pool } from '@/lib/db';

// Страница читает данные серверно при каждом запросе (без кэша),
// потому что результат зависит от строки поиска и фильтра.
export const dynamic = 'force-dynamic';

type Company = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  address: string | null;
  rating: string | null;        // NUMERIC приходит из pg строкой
  reviews_count: number;
  site: string | null;
  phone: string | null;
};

const LIMIT = 200;

async function getCities(): Promise<string[]> {
  const { rows } = await pool.query<{ city: string }>(
    `SELECT DISTINCT city FROM companies WHERE city IS NOT NULL ORDER BY city`
  );
  return rows.map((r) => r.city);
}

async function getCompanies(q: string, city: string) {
  // Параметризованный запрос — защита от SQL-инъекций.
  const where: string[] = [];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(`name ILIKE $${params.length}`);
  }
  if (city) {
    params.push(city);
    where.push(`city = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = await pool.query<{ n: string }>(
    `SELECT count(*)::int AS n FROM companies ${whereSql}`,
    params
  );

  params.push(LIMIT);
  const { rows } = await pool.query<Company>(
    `SELECT id, name, category, city, address, rating, reviews_count, site, phone
     FROM companies ${whereSql}
     ORDER BY reviews_count DESC, name
     LIMIT $${params.length}`,
    params
  );
  return { rows, total: Number(total.rows[0].n) };
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; city?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const city = (sp.city ?? '').trim();

  const [cities, { rows, total }] = await Promise.all([
    getCities(),
    getCompanies(q, city),
  ]);

  return (
    <main className="container">
      <h1>Компании</h1>
      <p className="subtitle">Данные из PostgreSQL · серверный рендеринг</p>

      {/* GET-форма: параметры уходят в URL (?q=&city=), удобно шарить ссылку */}
      <form className="filters" method="get">
        <div className="field">
          <label htmlFor="q">Поиск по названию</label>
          <input id="q" name="q" defaultValue={q} placeholder="например, Медиа" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="city">Город</label>
          <select id="city" name="city" defaultValue={city}>
            <option value="">Все города</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <button className="btn" type="submit">Применить</button>
        {(q || city) && (
          <a className="btn secondary" href="/companies">Сбросить</a>
        )}
      </form>

      <div className="count">
        Найдено: <b>{total}</b>
        {total > LIMIT && <> · показаны первые {LIMIT}</>}
        {(q || city) && (
          <> · фильтр: {q && <span className="badge">название: {q}</span>} {city && <span className="badge">город: {city}</span>}</>
        )}
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty">Ничего не найдено. Попробуй изменить запрос.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Название</th>
                <th>Категория</th>
                <th>Город</th>
                <th>Адрес</th>
                <th className="num">Рейтинг</th>
                <th className="num">Отзывов</th>
                <th>Сайт</th>
                <th>Телефон</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="muted">{c.category ?? '—'}</td>
                  <td>{c.city ?? '—'}</td>
                  <td className="muted">{c.address ?? '—'}</td>
                  <td className="num">{c.rating ?? '—'}</td>
                  <td className="num">{c.reviews_count}</td>
                  <td>
                    {c.site ? (
                      <a className="site" href={c.site} target="_blank" rel="noopener noreferrer">
                        {c.site.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="muted">{c.phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
