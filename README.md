# Bookshelf

A self-hosted personal book collection manager. Catalog physical books via ISBN scanning, track multiple copies with generated barcodes, and keep records of who has borrowed what.

## Features

- **ISBN Scanning** — Scan barcodes with phone camera, webcam, or USB scanner to auto-fill book metadata from Open Library / Google Books
- **Copy Tracking** — Manage multiple physical copies per book with generated Code128/QR barcodes
- **Loan Management** — Track who has borrowed which copy and when
- **Version History** — Every change is committed to DoltDB, providing a full audit trail
- **Catpuccin Mocha Theme** — Dark, minimalist UI designed for mobile-first use

## Quick Start

```bash
# Clone and configure
git clone <repo-url> && cd Bookshelf
cp .env.example .env
# Edit .env — at minimum set ADMIN_PASSWORD

# Launch
docker compose up -d

# Open browser
open http://localhost
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_PASSWORD` | Yes | `changeme` | Password for admin mode |
| `GOOGLE_BOOKS_API_KEY` | No | — | Enables Google Books as fallback ISBN source |
| `LIBRARY_NAME` | No | `Our Bookshelf` | Display name for your collection |
| `HOST_PORT` | No | `80` | Port to expose on the host |

## Google Books API Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Books API**
4. Create an API key (restrict to Books API)
5. Add to `.env` as `GOOGLE_BOOKS_API_KEY`

## Architecture

```
nginx (port 80) → frontend (React/Vite) + backend (FastAPI)
                                              ↓
                                         DoltDB (MySQL + version control)
```

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, TanStack Query
- **Backend:** Python FastAPI, SQLAlchemy (async), aiomysql
- **Database:** DoltDB — MySQL-compatible with built-in version control
- **Proxy:** Nginx — single entry point, no CORS

## Development

```bash
# Backend
cd backend
pip install -e .
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `localhost:8000`.

## Usage

1. Open the app and click the **lock icon** to enter admin mode
2. Navigate to **Scan** to add books by scanning ISBN barcodes
3. Add physical copies and print barcodes for them
4. Use **Quick Checkout/Return** in Scan mode to manage loans
5. Browse your collection, filter by genre/series/tags, and view stats on the Dashboard
6. Check **History** to see a complete audit trail of all changes
