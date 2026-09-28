# 3. Local Development

## Requirements

- Node.js 20.9 or newer (the current frontend is Next.js 16).
- npm.
- Two terminals for the API and web app.

## Install

```powershell
cd backend
npm install
```

```powershell
cd frontend
npm install
```

## Run the backend

```powershell
cd backend
npm run dev
```

The API listens on `http://localhost:4000` by default. `PORT` and `HOST` can override the local bind address.

## Run the frontend

```powershell
cd frontend
npm run dev
```

Open `http://localhost:3000`. The frontend defaults to `http://localhost:4000` for the API. To use another local backend, set `NEXT_PUBLIC_API_URL` before starting Next.js:

```powershell
$env:NEXT_PUBLIC_API_URL = "http://localhost:4001"
npm run dev
```

The browser connects to the local `/ws` WebSocket endpoint. If a WebSocket is unavailable, the shared client falls back to polling `/api/simulation` once per second.

## Useful commands

From `frontend/`:

```powershell
npm run lint
npm run build
```

From `backend/`:

```powershell
npm test
npm start
```

`npm test` uses Node's built-in test runner and does not require a separate test framework.

## Resetting the simulator

Use the dashboard's Reset control or `POST /api/simulation/reset`. Reset rebuilds the default nodes and Alice faucet state in memory. It does not persist prior sessions.

## Multiple worktrees or dev servers

Next.js uses `.next` by default. To run a second frontend instance concurrently, use a separate `NEXT_DIST_DIR`, for example `.next-chainlab-dev`, and a free port. The alternate output directory is ignored by Git and ESLint.
