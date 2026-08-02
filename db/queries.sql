SELECT
    category,
    count(*) AS companies
FROM companies
WHERE category IS NOT NULL
GROUP BY category
ORDER BY companies DESC, category
LIMIT 5;

SELECT
    city,
    round(avg(rating)::numeric, 2) AS avg_rating,
    count(*)                       AS companies_10plus_reviews
FROM companies
WHERE reviews_count >= 10
  AND rating IS NOT NULL
GROUP BY city
ORDER BY avg_rating DESC, city;

SELECT
    category,
    count(*)                                        AS total,
    count(site)                                     AS with_site,
    round(count(site)::numeric / count(*), 3)       AS site_share,
    round(100.0 * count(site) / count(*), 1)        AS site_share_pct
FROM companies
WHERE category IS NOT NULL
GROUP BY category
ORDER BY site_share DESC, category;
