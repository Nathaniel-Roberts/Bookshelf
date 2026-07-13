# Bookshelf frontend

React 19 + TypeScript + Vite, styled with Tailwind CSS (Catppuccin Mocha), data via TanStack Query.

```bash
npm install
npm run dev        # Vite dev server, proxies /api to localhost:8000
npm run build      # tsc -b && vite build
npm test           # vitest
npx eslint src
```

Structure:

- `src/pages/` — one component per route (see `src/App.tsx`)
- `src/components/` — shared UI (layout, cards, modals)
- `src/api/` — axios wrappers per resource; `client.ts` handles auth headers
- `src/hooks/` — auth context, camera/USB barcode scanners, page titles

See the root README for the full stack and deployment.
