-- ============================================================
--  Задача 1 — три аналитических запроса.
--  Запуск целиком:  psql "$DATABASE_URL" -f db/queries.sql
-- ============================================================

-- 1) Топ-5 категорий по числу компаний.
SELECT
    category,
    count(*) AS companies
FROM companies
WHERE category IS NOT NULL
GROUP BY category
ORDER BY companies DESC, category
LIMIT 5;

-- 2) Средний рейтинг по городам среди компаний с 10+ отзывами.
--    Учитываем только записи, где rating задан (NULL в среднее не идёт).
SELECT
    city,
    round(avg(rating)::numeric, 2) AS avg_rating,
    count(*)                       AS companies_10plus_reviews
FROM companies
WHERE reviews_count >= 10
  AND rating IS NOT NULL
GROUP BY city
ORDER BY avg_rating DESC, city;

-- 3) Доля компаний с сайтом по категориям.
--    site_share — доля (0..1), site_share_pct — та же доля в процентах.
SELECT
    category,
    count(*)                                        AS total,
    count(site)                                     AS with_site,   -- count(col) не считает NULL
    round(count(site)::numeric / count(*), 3)       AS site_share,
    round(100.0 * count(site) / count(*), 1)        AS site_share_pct
FROM companies
WHERE category IS NOT NULL
GROUP BY category
ORDER BY site_share DESC, category;
