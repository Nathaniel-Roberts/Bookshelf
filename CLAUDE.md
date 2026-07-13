# Bookshelf

Self-hosted personal book collection manager. FastAPI backend, React 19/Vite frontend, DoltDB (MySQL-compatible with version control) — every mutation makes a Dolt commit for the History audit trail.

## Commands

```bash
# Backend (backend/, needs Python 3.12+)
pip install -e ".[dev]"
ruff check app tests
pytest                        # sqlite in-memory; no database needed

# Frontend (frontend/)
npm run dev                   # proxies /api to localhost:8000
npx eslint src && npx tsc -b
npm test                      # vitest

# Full stack
docker compose up -d
```

## Architecture notes

- Schema lives in `backend/app/init_db.py` (raw SQL, run on startup, idempotent). There are no migration files — new columns/indexes must be added there with an existence check.
- Every write route calls `dolt_commit(db, message)` after `db.commit()`; keep that pattern for new mutations so History stays complete.
- Auth is a single shared admin password → JWT in localStorage. Public reads, admin writes (`Depends(require_admin)`).
- Settings keys must be added to `ALLOWED_SETTING_KEYS` in `backend/app/routers/settings.py`.
- The frontend nginx (frontend/nginx.conf) is the single entry point; backend is never exposed directly.
- Backend tests override `get_db` with sqlite and stub `dolt_commit` (see `tests/conftest.py`); Dolt-specific SQL (dolt_log, DOLT_REVERT etc.) can't be exercised there.
