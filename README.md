# Polza Agency — Technical Specialist Test Assignment

Load a company dataset into PostgreSQL, run 3 analytical SQL queries, build a `/companies` page on Next.js, and analyze a "messy" `review.csv`.

> 🇷🇺 Русская версия — [ниже](#русская-версия).

## Contents

```
.
├── data_pack/              # source data: page_001..020.json (~1000 companies) + review.csv
├── db/
│   ├── schema.sql          # DB schema: companies + staging reviews_raw, indexes, constraints
│   └── queries.sql         # 3 analytical queries from the assignment
├── scripts/
│   ├── db.mjs              # DB connection (DATABASE_URL from .env)
│   ├── csv.mjs             # tiny CSV parser (RFC 4180), no dependencies
│   ├── load_companies.mjs  # task 1: JSON pages → companies (dedup by id)
│   └── load_reviews.mjs    # task 3: review.csv → staging + report + merge of valid new rows
├── web/                    # task 2: Next.js (App Router), /companies page
├── proof/                  # task 2: screenshots + PROOF.md ("how I verified")
├── ANOMALIES.md            # task 3: every anomaly in review.csv and how it was found
├── docker-compose.yml      # PostgreSQL 17 in one command
├── package.json            # loader scripts (dependency: pg)
└── .env.example            # env template (no secrets in the repo)
```

## Requirements
- Node.js 20+ (tested on 24.18.1)
- PostgreSQL 14+ (easiest via Docker — see below) or a free Supabase project

## Quick start

**Windows, one click:** double-click **`run.bat`**. It auto-provisions Node (if missing), brings up PostgreSQL (an already-running one, or Docker, or a portable build it downloads), writes `.env`, loads the data, and opens `http://localhost:3000/companies`. The manual steps below are for other OSes / full control.

**1. Start PostgreSQL** (Docker recommended):
```bash
docker compose up -d          # Postgres 17 on localhost:5432, database "polza"
cp .env.example .env          # adjust DATABASE_URL if needed
```
Or **Supabase**: create a free project and copy the connection string (Session pooler) — see `.env.example`.

**2. Task 1 — load companies and run queries:**
```bash
npm install
npm run load:companies                 # applies schema.sql and loads ~1000 companies (dedup → 994)
psql "$DATABASE_URL" -f db/queries.sql
```

**3. Task 3 — load review.csv and get the report:**
```bash
npm run load:reviews                   # staging + anomaly report + merge of valid new rows
```

**4. Task 2 — the /companies page:**
```bash
cd web
cp .env.example .env                   # same DATABASE_URL
npm install
npm run dev                            # http://localhost:3000/companies
```

## Task 1: schema and data
- **Deduplication.** The dump has 20 pages × 50 = 1000 records, but **6 `id`s are duplicated** (rows are identical) → **994** unique companies. Dedup key is `id` (the natural key from the API); `INSERT ... ON CONFLICT (id) DO UPDATE` makes loading idempotent.
- **Missing values.** In the source: `rating` NULL for 79 rows, `site` NULL for 239, `phone` NULL for 110 — valid gaps the schema allows. `rating` is constrained to `CHECK (0..5)`, `reviews_count` to `NOT NULL DEFAULT 0 CHECK (>= 0)`.
- **Indexes:** on `city`, `category`, `rating`, on `lower(name)` (case-insensitive search) and on the expression `(site IS NOT NULL)`.

Query results (on the 994 companies from task 1):

**1) Top-5 categories by number of companies**
| category | companies |
|---|---|
| IT-интегратор | 94 |
| Оптовая торговля | 79 |
| Рекламное агентство | 76 |
| Строительная компания | 71 |
| Юридические услуги | 63 |

**2) Average rating by city (companies with 10+ reviews)** — top rows: Сочи 4.46, Пермь 4.43, Омск 4.41, … Москва 4.23 (177 companies).

**3) Share of companies with a website by category** — top rows: Клининг 88.9%, Ресторан 85.4%, Юридические услуги 84.1%, …

Full results reproduce with `psql "$DATABASE_URL" -f db/queries.sql`.

## Task 2: the /companies page
Next.js (App Router). Route `/companies`: a table of companies from Postgres with **name search** (`ILIKE`) and **city filter** (city list comes from the DB). Data is fetched **server-side** (Server Component, parameterized queries). No secrets in the repo — only `web/.env.example`.

Proof of work and the "how I verified" section — in [proof/PROOF.md](proof/PROOF.md) (with screenshots).

## Task 3: the "surprise" review.csv
`npm run load:reviews` loads the CSV as-is into the `reviews_raw` staging table, prints a short report, and merges into `companies` only valid **new** rows (broken values → `NULL`/`0`; duplicates and already-existing `id`s are skipped).

Report highlights: 207 rows → 2 empty, 3 duplicate `id`s, **6 rows reference already-existing companies** (the dump is not "fresh"), broken `rating` / `reviews_count` / `site` / `phone`, plus messy text: inconsistent city spellings (`Moscow`, `москва`, a typo), **double-encoding corruption (mojibake)** in `name`/`city`, and a **column-shifted row**. All normalized against the canonical city/category set from the base data (`scripts/clean.mjs`). Result: +196 new companies (994 → **1190**).

Full breakdown — in [ANOMALIES.md](ANOMALIES.md).

## Task 4
Written answers are submitted separately as a text file, per the assignment.

## Reproducibility note
The loader scripts are plain Node.js (single dependency — `pg`), the CSV parser is custom, `.env` is kept out of the repo. Re-running any loader is safe (idempotent upserts).

---

<a name="русская-версия"></a>

# 🇷🇺 Русская версия

Тестовое задание на позицию «Технический специалист»: выгрузка компаний → PostgreSQL, аналитические SQL-запросы, страница `/companies` на Next.js и разбор «данных с сюрпризом» (`review.csv`).

## Что внутри

```
.
├── data_pack/              # исходные данные: page_001..020.json (~1000 компаний) + review.csv
├── db/
│   ├── schema.sql          # схема БД: companies + staging reviews_raw, индексы, ограничения
│   └── queries.sql         # 3 аналитических запроса из задания
├── scripts/
│   ├── db.mjs              # подключение к БД (DATABASE_URL из .env)
│   ├── csv.mjs             # мини CSV-парсер (RFC 4180), без зависимостей
│   ├── load_companies.mjs  # задача 1: JSON-страницы → companies (дедуп по id)
│   └── load_reviews.mjs    # задача 3: review.csv → staging + отчёт + мёрж валидных новых
├── web/                    # задача 2: Next.js (App Router), страница /companies
├── proof/                  # задача 2: скриншоты + PROOF.md («как проверял»)
├── ANOMALIES.md            # задача 3: все аномалии review.csv и как обнаружены
├── docker-compose.yml      # PostgreSQL 17 одной командой
├── package.json            # скрипты загрузки (зависимость: pg)
└── .env.example            # шаблон переменных окружения (секретов в репо нет)
```

## Требования
- Node.js 20+ (проверено на 24.18.1)
- PostgreSQL 14+ (проще всего через Docker — см. ниже) либо бесплатный Supabase

## Быстрый старт

**Windows, в один клик:** запусти **`run.bat`**. Он сам поставит Node (если нет), поднимет PostgreSQL (уже запущенный / через Docker / портативный, который скачает), запишет `.env`, загрузит данные и откроет `http://localhost:3000/companies`. Ручные шаги ниже — для других ОС или полного контроля.

**1. Поднять PostgreSQL** (Docker рекомендуется):
```bash
docker compose up -d          # Postgres 17 на localhost:5432, база polza
cp .env.example .env          # при необходимости поправить DATABASE_URL
```
Или **Supabase**: создай бесплатный проект и возьми строку подключения (Session pooler) — см. `.env.example`.

**2. Задача 1 — загрузить компании и выполнить запросы:**
```bash
npm install
npm run load:companies                 # применит schema.sql и зальёт ~1000 компаний (дедуп → 994)
psql "$DATABASE_URL" -f db/queries.sql
```

**3. Задача 3 — загрузить review.csv и получить отчёт:**
```bash
npm run load:reviews                   # staging + отчёт по аномалиям + мёрж валидных новых записей
```

**4. Задача 2 — страница /companies:**
```bash
cd web
cp .env.example .env                   # тот же DATABASE_URL
npm install
npm run dev                            # http://localhost:3000/companies
```

## Задача 1: схема и данные
- **Дедупликация.** В выгрузке 20 страниц × 50 = 1000 записей, но **6 `id` дублируются** (строки идентичны) → в базе **994** уникальные компании. Ключ дедупа — `id` (естественный ключ из API), `INSERT ... ON CONFLICT (id) DO UPDATE` делает загрузку идемпотентной.
- **Пропуски.** В исходных данных: `rating` NULL у 79 записей, `site` NULL у 239, `phone` NULL у 110 — валидные пропуски, схема их допускает. `rating` ограничен `CHECK (0..5)`, `reviews_count` — `NOT NULL DEFAULT 0 CHECK (>= 0)`.
- **Индексы:** по `city`, `category`, `rating`, по `lower(name)` (регистронезависимый поиск) и по выражению `(site IS NOT NULL)`.

Результаты запросов (на 994 компаниях из задачи 1):

**1) Топ-5 категорий по числу компаний**
| category | companies |
|---|---|
| IT-интегратор | 94 |
| Оптовая торговля | 79 |
| Рекламное агентство | 76 |
| Строительная компания | 71 |
| Юридические услуги | 63 |

**2) Средний рейтинг по городам (компании с 10+ отзывами)** — топ: Сочи 4.46, Пермь 4.43, Омск 4.41, … Москва 4.23 (177 компаний).

**3) Доля компаний с сайтом по категориям** — топ: Клининг 88.9%, Ресторан 85.4%, Юридические услуги 84.1%, …

Полные результаты воспроизводятся командой `psql "$DATABASE_URL" -f db/queries.sql`.

## Задача 2: страница /companies
Next.js (App Router). Маршрут `/companies`: таблица компаний из Postgres с **поиском по названию** (`ILIKE`) и **фильтром по городу** (список городов из БД). Данные тянутся **серверно** (Server Component, параметризованные запросы). Секретов в репозитории нет — только `web/.env.example`.

Доказательство работы и раздел «как проверял» — в [proof/PROOF.md](proof/PROOF.md) (со скриншотами).

## Задача 3: review.csv «с сюрпризом»
`npm run load:reviews` грузит CSV «как есть» в staging-таблицу `reviews_raw`, печатает короткий отчёт и мёржит в `companies` только валидные **новые** записи (битые значения → `NULL`/`0`, дубли и уже существующие `id` — пропускаются).

Коротко: 207 строк → 2 пустые, 3 дубля `id`, **6 записей ссылаются на уже существующие компании** (выгрузка не «свежая»), битые `rating` / `reviews_count` / `site` / `phone`, а также грязный текст: разнобой в написании городов (`Moscow`, `москва`, опечатка), **битая кодировка (мохибейк)** в `name`/`city` и **строка со сдвигом колонок**. Всё нормализовано по эталонному набору городов/категорий из базовой выгрузки (`scripts/clean.mjs`). Итог: +196 новых компаний (994 → **1190**).

Полный разбор — в [ANOMALIES.md](ANOMALIES.md).

## Задача 4
Письменные ответы сдаются отдельным текстовым файлом (по условию задания).

## Заметка о воспроизводимости
Скрипты загрузки — на чистом Node.js (единственная зависимость — `pg`), CSV-парсер свой, `.env` вынесен из репозитория. Повторный запуск любого загрузчика безопасен (идемпотентные upsert-ы).
