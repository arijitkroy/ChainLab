# 7. Vercel Deployment

ChainLab is configured as two independent Vercel projects from one repository. Deploy `frontend/` and `backend/` separately; each folder contains its own `vercel.json`.

## 1. Deploy the backend API

1. Import the repository as a Vercel project.
2. Set the project's **Root Directory** to `backend`.
3. Keep the detected Node.js runtime and install command (`npm install`).
4. Deploy. Vercel uses `backend/vercel.json` to route HTTP requests to `server.js`, which exports the Express app.
5. Copy the resulting HTTPS URL, for example `https://chainlab-api-your-team.vercel.app`.

The local process still starts with `npm run dev` and provides both HTTP and `ws` WebSocket support. When `VERCEL=1`, `server.js` exports the Express app without calling `listen()` or creating a WebSocket listener, as required for a serverless function.

## 2. Deploy the frontend

1. Create a second Vercel project from the same repository.
2. Set its **Root Directory** to `frontend`.
3. Add `NEXT_PUBLIC_API_URL` for Production, Preview, and Development as appropriate. Set it to the backend deployment's HTTPS origin, with no required trailing slash.
4. Deploy. `frontend/vercel.json` declares the Next.js framework.

The API URL is embedded into the client bundle at build time. Redeploy the frontend after changing it. Each Preview frontend should point at an API intended for Preview if you need isolated preview environments.

## Runtime limitations

- Vercel Functions are request/response serverless invocations. They do not support this project's persistent `ws` server. In deployed mode the frontend switches to one-second HTTP snapshot polling when `/ws` closes.
- The simulator stores chains, wallets, mempools, and events in JavaScript process memory. Vercel may create multiple instances or discard one after an invocation, so a deployed backend is suitable for a demonstration, not a single authoritative shared simulation. Different function instances can show divergent or reset state.
- Automatic timers and continuous background mining are not reliable in serverless functions. Use individual HTTP commands for demonstrations; they run for the duration of a request only.
- For durable, shared production behavior, move mutable state to a database/Redis-compatible store and host persistent WebSockets/background work on a service that supports long-running processes. This is intentionally outside the current in-memory deployment.

## Local versus deployed configuration

| Setting | Local default | Vercel |
| --- | --- | --- |
| API origin | `http://localhost:4000` | `NEXT_PUBLIC_API_URL` |
| Realtime | WebSocket `/ws` | HTTP polling fallback |
| State | Process memory | Per-function-instance memory (not durable/shared) |

Do not deploy wallet private keys as environment variables. ChainLab generates simulated keys in memory and never returns private key material from its API.
