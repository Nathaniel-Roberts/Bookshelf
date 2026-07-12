# Bookshelf — Code Review Findings

Reviewed: full repo (FastAPI backend, React 19/Vite frontend, DoltDB, nginx, Docker/GHCR deploy) as of commit `b2c5cc5`.

Format per item: **Severity** | Effort | `file:line` — issue. *Fix:* one-liner.

---

## 1. Feature Ideas

No severity ratings here; ordered by likely value.

1. **Backup restore / import** (Effort: Medium) — `backend/app/routers/settings.py:69` exports JSON but there's no way to restore it. A backup you can't restore is only half a feature. *Add a `POST /settings/restore` that validates and imports the JSON export.*
2. **Due dates and overdue tracking** (Effort: Medium) — `backend/app/models/loan.py` has no `due_date`. For a lending app this is the obvious gap: you can see who has a book but not who's late. *Add optional `due_date` to loans, highlight overdue rows in Loans/Dashboard.*
3. **Return-by-barcode endpoint** (Effort: Small) — `frontend/src/pages/Scan.tsx:66` currently fetches all active loans client-side to find the loan for a scanned copy. *Add `PUT /api/loans/return-by-barcode/{barcode}`; makes quick-return one round trip and removes the workaround.*
4. **Show diffs in the History page** (Effort: Medium) — the backend diff endpoint (`backend/app/routers/history.py:31`) and the client function (`frontend/src/api/history.ts:13`) both exist but no UI uses them. The DoltDB audit trail is the app's headline feature; surfacing "what changed" per commit would make it genuinely useful. *Add an expandable diff view per history entry.*
5. **Finish the local cover cache** (Effort: Medium) — `cover_local` column, the `/app/covers` volume, and Dockerfile dir all exist but nothing ever writes them. Covers currently hotlink Open Library/Google, which is slow and breaks offline. *Download covers on book create and serve from the covers volume.*
6. **Bulk barcode label printing** (Effort: Medium) — barcodes render one at a time on BookDetail. Anyone cataloguing a real shelf wants a printable A4 sheet of labels. *Add a print view that lays out selected copies' barcodes on a label grid.*
7. **Reading status / wishlist** (Effort: Medium) — books only have favourite + rating. A `status` field (owned / want / reading / read) broadens the app from inventory to personal library tracker.
8. **Use the settings you already store** (Effort: Small) — `library_name` and `default_barcode_format` are editable in Settings but ignored everywhere (Layout hardcodes "Bookshelf" at `frontend/src/components/Layout.tsx:959`; `create_copy` ignores the format default). *Wire them up or drop them.*
9. **CSV export** (Effort: Small) — JSON backup is for machines; a CSV of books is for spreadsheets and insurance lists. *Add a CSV option next to the JSON backup.*
10. **Collection value stat** (Effort: Small) — `acquisition_price` is captured per copy but never aggregated. *Show total collection value on the Dashboard.*

---

## 2. Code Quality & Architecture

1. **High** | Small | `frontend/src/pages/AddBook.tsx:103` — Manual Entry tab is non-functional: `updateField` returns early when `form` is null, and nothing initialises `form` when switching to the manual tab, so every input is dead and Save stays disabled. *Fix:* initialise an empty `BookCreate` form when the manual tab is selected.
2. **Medium** | Small | `backend/app/services/dolt.py:15` — blanket `except Exception: return None` means any real Dolt failure silently skips the audit commit; the "no changes" case is indistinguishable from a broken audit trail. *Fix:* catch the specific "nothing to commit" error, log everything else.
3. **Medium** | Small | `backend/app/routers/books.py` (`update_book`) — no duplicate-ISBN check on update (create has one), so updating a book to an existing ISBN hits the DB unique constraint and returns an unhandled 500. *Fix:* replicate the 409 duplicate check, or catch `IntegrityError`.
4. **Medium** | Small | `frontend/src/api/client.ts:19` — the 401 interceptor removes the token but `useAuth` state isn't updated, so the UI stays in admin mode with every action failing until a page reload. *Fix:* broadcast the logout (event or shared store) so `isAdmin` flips immediately.
5. **Medium** | Small | `frontend/src/pages/Scan.tsx:56` — return mode contains confused stream-of-consciousness comments, a mid-function dynamic `import()`, and a fetch-all-loans workaround. *Fix:* clean up once the return-by-barcode endpoint exists (Feature 3).
6. **Low** | Small | `backend/app/routers/books.py:58` — two overlapping favourite filters (`is_favourite` bool and `favourites` string); the frontend only uses `favourites=true`. *Fix:* keep one parameter.
7. **Low** | Small | `backend/app/routers/books.py:84` — `sort=series` sorts by `series_position`, a string column, so "10" sorts before "2"; the option is also unused by the UI. *Fix:* remove it or cast to a numeric sort.
8. **Low** | Small | `backend/app/routers/lookup.py:28` and `backend/app/routers/history.py:40` — errors returned as HTTP 200 with an `{"error": ...}` body, inconsistent with the `HTTPException` pattern everywhere else. *Fix:* raise 404/422 respectively.
9. **Low** | Small | `frontend/src/hooks/useScanner.ts:63` — `useKeyboardScanner` (USB scanner support) is exported but never used anywhere. *Fix:* wire it into Scan/AddBook or delete it.
10. **Low** | Small | `frontend/src/api/history.ts:13` — `fetchDiff` is dead code (see Feature 4). *Fix:* use it or remove it.
11. **Low** | Small | `backend/app/deps.py:13` — `get_db_session` is a pointless pass-through wrapper around `get_db`. *Fix:* depend on `get_db` directly.
12. **Low** | Small | `backend/app/init_db.py:87` — builds its own engine and splits SQL on `";"` instead of reusing `database.py`'s engine; fragile if any statement ever contains a semicolon. *Fix:* reuse the shared engine and execute statements as a list.
13. **Low** | Small | `frontend/src/pages/BookDetail.tsx:373` — `conditionColor` maps a non-existent `damaged` condition and misses the real `like_new`, which falls through to the grey default and renders as "Like_new". *Fix:* align the map with the enum and humanise the label.
14. **Low** | Small | `frontend/src/pages/Settings.tsx:42` — `saveAll` fires three mutations through one `useMutation`, producing three toasts and racy pending state. *Fix:* batch into one request or use `Promise.all` in a single mutation.
15. **Low** | Small | `backend/app/routers/settings.py:76` — `datetime.utcnow()` is deprecated since Python 3.12 (the project's floor). *Fix:* `datetime.now(timezone.utc)`.
16. **Low** | Small | `backend/pyproject.toml:9` — `passlib[bcrypt]` is declared but never imported (passwords aren't hashed at all — see Security 4). *Fix:* remove it, or better, actually use password hashing.
17. **Low** | Small | `backend/app/routers/books.py:20` — `_book_to_response` hand-maps ~25 fields that `BookResponse.model_validate` could handle with a couple of computed extras. *Fix:* use `model_validate` plus explicit extras.
18. **Low** | Small | `frontend/src/App.tsx:20` — no catch-all 404 route; unknown URLs render an empty layout. *Fix:* add `<Route path="*">` with a not-found page.
19. **Low** | Small | `frontend/src/pages/SeriesDetail.tsx:12` — page title is hardcoded "Series" instead of the series name. *Fix:* call `usePageTitle(series?.name ?? 'Series')` after the query.
20. **Low** | Small | `frontend/src/pages/AddBook.tsx:63` — `metadata_source` can be sent as `''`, which isn't in the DB enum (`openlibrary|googlebooks|manual`) and would 500 on insert. *Fix:* default to `'manual'` and validate the enum in `BookCreate`.

---

## 3. Security

1. **Critical** | Small | `docker-compose.yml:10`, `docker-compose.prod.yml:31` — `ports: - "3306"` publishes DoltDB on a random host port, exposing the database (root password `bookshelf`, see below) beyond the compose network. *Fix:* delete the `ports` entry entirely; backend reaches it over the internal network.
2. **High** | Small | `dolt/init.sql:1`, `docker-compose.prod.yml:14`, `docker-compose.yml:8` — hardcoded DB credentials (`bookshelf`/`bookshelf`, root password `bookshelf`) with `GRANT ALL PRIVILEGES ON *.* ... WITH GRANT OPTION`. Combined with the port exposure above this is full DB compromise. *Fix:* take passwords from env, grant only on the `bookshelf` database, drop `WITH GRANT OPTION`.
3. **High** | Medium | `backend/app/routers/auth.py:10` — no rate limiting or lockout on `/api/auth/login`; a single shared password can be brute-forced freely on a self-hosted, often internet-exposed app. *Fix:* add slowapi (or nginx `limit_req`) on the login route.
4. **Medium** | Small | `backend/app/auth.py:25` — plaintext password comparison with `==`: not constant-time (timing side channel) and the password lives unhashed in env/compose. *Fix:* at minimum `secrets.compare_digest`; ideally store a bcrypt hash (passlib is already a dependency).
5. **Medium** | Small | `backend/app/config.py:15` — `admin_password` silently defaults to `changeme`; config.py warns loudly about a missing SECRET_KEY but says nothing about the default admin password. *Fix:* emit the same startup warning (or refuse to start) when `ADMIN_PASSWORD` is unset/`changeme`.
6. **Medium** | Small | `backend/pyproject.toml:8` — `python-jose>=3.3` permits installing 3.3.0, which has known CVEs (CVE-2024-33663 algorithm confusion, CVE-2024-33664 JWE DoS), and the project is barely maintained. *Fix:* floor at `>=3.4` or migrate to PyJWT.
7. **Medium** | Small | `backend/app/routers/loans.py:34,45,55` and `backend/app/routers/history.py:11,31` — borrower names, full loan history, and the complete change log (including via table diffs) are readable without any auth. Public read may be intentional for the catalogue, but personal names are different. *Fix:* require admin on loans/history endpoints, or add a "private mode" setting.
8. **Medium** | Small | `backend/app/schemas/book.py:23,45` — no validation constraints: `rating` unbounded (TINYINT overflows >127 → 500), `page_count` can be negative, ISBNs unchecked for length/checksum. *Fix:* add Pydantic `Field(ge=1, le=5)` etc. and an ISBN validator.
9. **Low** | Medium | `frontend/src/api/client.ts:5` — JWT stored in `localStorage`, exfiltratable by any future XSS. Acceptable trade-off for this app class, but worth knowing. *Fix:* httpOnly cookie session if the threat model ever tightens.
10. **Low** | Small | `nginx/default.conf:1`, `frontend/nginx.conf:1` — no security headers (`X-Content-Type-Options`, `X-Frame-Options`/CSP, `Referrer-Policy`) and no HTTPS/TLS guidance in the README for a deploy that handles a password. *Fix:* add standard headers and a note recommending a TLS-terminating reverse proxy.
11. **Low** | Small | `backend/app/routers/books.py:66` — user-supplied `%`/`_` wildcards in search/genre/tag LIKE patterns aren't escaped. Parameters are bound so there's no injection, only filter-bypass oddities. *Fix:* escape LIKE metacharacters.
12. **Low** | Small | `backend/app/routers/settings.py:29` — `PUT /settings/{key}` accepts arbitrary keys, letting an admin bloat the table with junk rows. *Fix:* validate against a known-keys allowlist.

---

## 4. Performance

1. **Medium** | Medium | `backend/app/routers/books.py:62` — `list_books` loads every book with all copies and all loans (three-level `selectinload`) on every request, then computes availability and filters in Python. Fine at 200 books, painful at 5,000. *Fix:* compute copy/loan counts with SQL aggregates and filter availability in the query; add pagination.
2. **Medium** | Small | `frontend/src/pages/Browse.tsx:536` — Browse fires two full-collection fetches (filtered list + unfiltered list just to derive genre/tag dropdowns) and re-hits the backend on every filter change with only 5s staleTime. *Fix:* add a lightweight `/api/books/facets` endpoint (or derive facets from the filtered query) and raise staleTime.
3. **Low** | Small | `backend/app/services/isbn_lookup.py:16` — `_check_cover_url` downloads the entire image (possibly twice per lookup) just to check its size, and Open Library author names are fetched sequentially. *Fix:* stream/HEAD with early exit; `asyncio.gather` the author fetches.
4. **Low** | Small | `backend/app/init_db.py:20` — no secondary indexes: `loans.returned_date` (active-loan filter) and `books.title` (search/sort) are scanned. Irrelevant at hobby scale, cheap to add. *Fix:* index `loans(returned_date)` and `books(title)`.
5. **Low** | Small | `frontend/src/pages/Scan.tsx:67` — quick return fetches all active loans to find one (also listed under Code Quality); O(n) network payload per scan. *Fix:* return-by-barcode endpoint.
6. **Low** | Medium | `backend/Dockerfile:1` — single-stage image keeps gcc/libc-dev build deps in the runtime layer, and runs as root. *Fix:* multi-stage build (wheels then slim runtime) with a non-root user.

---

## 5. Testing & Reliability

1. **High** | Large | repo-wide — zero tests: no pytest suite for the backend (auth, ISBN lookup parsing, loan state transitions are all untested), no frontend tests. *Fix:* start with pytest + httpx `ASGITransport` for router tests and a couple of Vitest tests for `useScanner`/AddBook.
2. **High** | Small | `.github/workflows/build.yml:1` — CI only builds and pushes Docker images on main; no lint, typecheck, or test gate, and nothing runs on PRs (frontend `tsc` only runs incidentally inside the image build). *Fix:* add a PR workflow running `eslint`, `tsc -b`, backend `ruff`/`pytest`.
3. **Medium** | Small | `backend/app/services/dolt.py:8` — every mutation does `db.commit()` then a separate `dolt_commit()`; a failure or concurrent write between the two produces missing or wrongly-attributed audit commits, silently (see Code Quality 2). *Fix:* log dolt failures and consider doing the Dolt commit in the same transaction/connection.
4. **Medium** | Small | `backend/app/main.py:17` — no logging configuration anywhere in the backend; external lookup failures, dolt errors, and 500s leave no trace beyond uvicorn access logs. *Fix:* configure `logging` and log in the `except` blocks (`isbn_lookup.py:30`, `dolt.py:15`).
5. **Low** | Small | `docker-compose.yml:20` — backend has no healthcheck and frontend's `depends_on` has no condition, so nginx can come up serving 502s during backend start. *Fix:* add a healthcheck hitting `/api/health` and gate the frontend on it.
6. **Low** | Small | `frontend/src/App.tsx:15` — no React error boundary; any render error blanks the whole SPA. *Fix:* wrap routes in an error boundary with a reload prompt.

---

## 6. Documentation & Developer Experience

1. **Medium** | Small | `README.md:21` — the "no clone" deploy tells users to download `nginx/default.conf` and rename it `nginx.conf`, but `docker-compose.prod.yml` defines no nginx service and never mounts that file; the step does nothing and the downloaded `init.sql` is likewise unused (prod compose inlines it as a config). *Fix:* trim the deploy instructions to just the compose file + `.env`.
2. **Medium** | Small | `README.md:59` vs `.env.example:12` — README documents `HOST_PORT` default as `80` ("Open http://your-server") but compose defaults to `8484`. Fresh deploys following the README won't find the app. *Fix:* make the docs and compose default agree.
3. **Low** | Small | repo root — no LICENSE file for a public GitHub repo; legally it's all-rights-reserved, which contradicts the self-host pitch. *Fix:* add a licence (MIT/Apache-2.0).
4. **Low** | Small | `frontend/README.md:1` — stock Vite template README, no value. *Fix:* delete it or replace with frontend-specific notes.
5. **Low** | Small | repo root — no CONTRIBUTING/dev-workflow notes (how to run Dolt locally without Docker, how init_db seeds settings) and no `CLAUDE.md`/editor config for consistent formatting. *Fix:* a short "Development" section expansion in the README covers it.
6. **Low** | Small | `.env.example:2` — ships `ADMIN_PASSWORD=changeme` as the example value, which people deploy verbatim (see Security 5). *Fix:* leave it blank with a comment demanding a value.
