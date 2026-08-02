CREATE TABLE IF NOT EXISTS companies (
    id            TEXT PRIMARY KEY,
    name          TEXT        NOT NULL,
    category      TEXT,
    city          TEXT,
    address       TEXT,
    rating        NUMERIC(2,1) CHECK (rating >= 0 AND rating <= 5),
    reviews_count INTEGER     NOT NULL DEFAULT 0 CHECK (reviews_count >= 0),
    site          TEXT,
    phone         TEXT,
    source        TEXT        NOT NULL DEFAULT 'api_pages',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_city         ON companies (city);
CREATE INDEX IF NOT EXISTS idx_companies_category     ON companies (category);
CREATE INDEX IF NOT EXISTS idx_companies_rating       ON companies (rating);
CREATE INDEX IF NOT EXISTS idx_companies_name_lower   ON companies (lower(name));
CREATE INDEX IF NOT EXISTS idx_companies_site_notnull ON companies ((site IS NOT NULL));

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
