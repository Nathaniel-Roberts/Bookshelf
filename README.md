# Bookshelf

A self-hosted personal book collection manager. Catalog physical books via ISBN scanning, track multiple copies with generated barcodes, and keep records of who has borrowed what.

## Features

- **ISBN Scanning** — Scan barcodes with phone camera, webcam, or USB scanner to auto-fill book metadata from Open Library / Google Books
- **Copy Tracking** — Manage multiple physical copies per book with generated Code128/QR barcodes
- **Loan Management** — Track who has borrowed which copy and when
- **Version History** — Every change is committed to DoltDB, providing a full audit trail
- **Catpuccin Mocha Theme** — Dark, minimalist UI designed for mobile-first use

## Deploy (no clone needed)

On your server, create a directory and download one file:

```bash
mkdir bookshelf && cd bookshelf

curl -LO https://raw.githubusercontent.com/Nathaniel-Roberts/Bookshelf/main/docker-compose.prod.yml

# Create your .env
cat > .env << 'EOF'
ADMIN_PASSWORD=your-secure-password
SECRET_KEY=your-random-secret-key
HOST_PORT=80
EOF

# Launch
docker compose -f docker-compose.prod.yml up -d
```

Open `http://your-server` in a browser (or `http://your-server:8484` if you left `HOST_PORT` unset).

If the app is reachable beyond your home network, put a TLS-terminating reverse proxy (Caddy, Traefik, nginx with certbot) in front of it — the admin password is otherwise sent in plain HTTP.

## Quick Start (from source)

```bash
git clone https://github.com/Nathaniel-Roberts/Bookshelf.git && cd Bookshelf
cp .env.example .env
# Edit .env — set ADMIN_PASSWORD and SECRET_KEY

docker compose up -d
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_PASSWORD` | Yes | — | Password for admin mode. The app warns at startup if unset |
| `SECRET_KEY` | Yes | auto-generated | JWT signing key. Set for persistent sessions across restarts |
| `GOOGLE_BOOKS_API_KEY` | No | — | Enables Google Books as fallback ISBN source |
| `LIBRARY_NAME` | No | `Our Bookshelf` | Display name for your collection |
| `HOST_PORT` | No | `8484` | Port to expose on the host |
| `DB_PASSWORD` | No | `bookshelf` | App database password (internal network only; applied on first start) |
| `DB_ROOT_PASSWORD` | No | `bookshelf` | DoltDB root password (applied on first start) |

## Google Books API Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Books API**
4. Create an API key (restrict to Books API)
5. Add to `.env` as `GOOGLE_BOOKS_API_KEY`

## Architecture

```
frontend container (nginx: static React app + /api proxy)
                          ↓
               backend (FastAPI, port 8000)
                          ↓
             DoltDB (MySQL + version control)
```

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, TanStack Query; served by nginx which also proxies `/api` (single entry point, no CORS)
- **Backend:** Python FastAPI, SQLAlchemy (async), asyncmy
- **Database:** DoltDB — MySQL-compatible with built-in version control
- **Images:** Published to `ghcr.io/nathaniel-roberts/bookshelf` on every push to main

## Development

```bash
# Database — the backend expects a MySQL-compatible server; easiest is Docker:
docker compose up -d doltdb

# Backend
cd backend
pip install -e ".[dev]"
DATABASE_HOST=127.0.0.1 uvicorn app.main:app --reload
# (when running doltdb via compose without the port published, either add a
# ports entry locally or run everything with: docker compose up)

# Frontend
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `localhost:8000`. Tables and seed settings are created automatically at backend startup (`app/init_db.py`).

Tests and lint:

```bash
cd backend && ruff check app tests && pytest   # sqlite in-memory, no DB needed
cd frontend && npx eslint src && npx tsc -b && npm test
```

Both run in CI on every pull request.

## Usage

1. Open the app and click the **lock icon** to enter admin mode
2. Navigate to **Scan** to add books by scanning ISBN barcodes
3. Add physical copies and print barcodes for them
4. Use **Quick Checkout/Return** in Scan mode to manage loans
5. Browse your collection, filter by genre/series/tags, and view stats on the Dashboard
6. Check **History** to see a complete audit trail of all changes
7. **Settings** — backup your library as JSON, configure preferences

## License

[MIT](LICENSE)
