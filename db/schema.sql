-- ============================================================
--  Polza Agency — тестовое задание
--  Схема БД для компаний (задача 1) + staging для review.csv (задача 3)
--  PostgreSQL 14+
-- ============================================================

-- Основная таблица компаний.
-- id из источника — естественный ключ, на нём же строится дедупликация.
CREATE TABLE IF NOT EXISTS companies (
    id            TEXT PRIMARY KEY,                 -- "c_000001" из выгрузки API
    name          TEXT        NOT NULL,
    category      TEXT,
    city          TEXT,
    address       TEXT,
    rating        NUMERIC(2,1) CHECK (rating >= 0 AND rating <= 5),  -- 0.0..5.0, NULL допустим
    reviews_count INTEGER     NOT NULL DEFAULT 0 CHECK (reviews_count >= 0),
    site          TEXT,
    phone         TEXT,
    source        TEXT        NOT NULL DEFAULT 'api_pages',          -- откуда приехала запись
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индексы под запросы из задания и под страницу /companies.
CREATE INDEX IF NOT EXISTS idx_companies_city         ON companies (city);
CREATE INDEX IF NOT EXISTS idx_companies_category     ON companies (category);
CREATE INDEX IF NOT EXISTS idx_companies_rating       ON companies (rating);
-- Поиск по названию без учёта регистра (ILIKE / lower()).
CREATE INDEX IF NOT EXISTS idx_companies_name_lower   ON companies (lower(name));
-- Ускоряет вычисление "доли компаний с сайтом".
CREATE INDEX IF NOT EXISTS idx_companies_site_notnull ON companies ((site IS NOT NULL));

-- ------------------------------------------------------------
-- Staging-таблица для review.csv (задача 3).
-- Все колонки TEXT: сырые данные грузим "как есть", чтобы битые
-- значения (N/A, "4,5", "много", -10) не рушили загрузку, а потом
-- разбираем их валидацией. line_no — номер строки в исходном CSV.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews_raw (
    line_no       INTEGER PRIMARY KEY,
    id            TEXT,
    name          TEXT,
    category      TEXT,
    city          TEXT,
    address       TEXT,
    rating        TEXT,
    reviews_count TEXT,
    site          TEXT,
    phone         TEXT
);
