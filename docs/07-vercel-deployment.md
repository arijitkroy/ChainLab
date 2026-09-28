# 7. Vercel Deployment

ChainLab's root `vercel.json` configures the repository as one Vercel deployment with two services. The `frontend` service runs Next.js from `frontend/`; the `backend` service runs the Express API from `backend/`. Requests under `/api/backend` are routed to the API and all other paths go to the frontend service.

## Deploy the combined project

1. Import the repository into Vercel and leave the project **Root Directory** at the repository root.
2. Keep the detected Node.js runtime and npm install/build settings for the two configured services.
3. Add `NEXT_PUBLIC_API_URL` for Production, Preview, and Development. Set it to `https://<deployment-domain>/api/backend` (for example, `https://chainlab-your-team.vercel.app/api/backend`).
4. Deploy the project. The root rewrites send `/api/backend/...` requests to the backend service and other requests to the frontend.

The backend strips the `/api/backend` service prefix if it is present, so its routes remain `/api/...` internally. Direct local routes such as `http://localhost:4000/api/simulation` continue to work unchanged. The backend entry exports the Express app without calling `listen()` or opening a WebSocket listener in Vercel; locally it still starts HTTP and `ws` together.

The nested `frontend/vercel.json` and `backend/vercel.json` are available when deploying either app as a separate Vercel project. For the combined two-service deployment described here, use the repository-root config.

`NEXT_PUBLIC_API_URL` is embedded into the frontend bundle at build time. Redeploy after changing it. Preview deployments should set the variable to the corresponding preview deployment URL.

## Runtime limitations

- Vercel Functions are request/response serverless invocations. They do not support this project's persistent `ws` server. In deployed mode the frontend switches to one-second HTTP snapshot polling when `/ws` closes.
- The simulator stores chains, wallets, mempools, and events in JavaScript process memory. Vercel may create multiple instances or discard one after an invocation, so a deployed backend is suitable for a demonstration, not a single authoritative shared simulation. Different function instances can show divergent or reset state.
- Automatic timers and continuous background mining are not reliable in serverless functions. Use individual HTTP commands for demonstrations; they run for the duration of a request only.
- For durable, shared production behavior, move mutable state to a database/Redis-compatible store and host persistent WebSockets/background work on a service that supports long-running processes. This is intentionally outside the current in-memory deployment.

## Local versus deployed configuration

| Setting | Local default | Vercel |
| --- | --- | --- |
| API origin | `http://localhost:4000` | `https://<deployment-domain>/api/backend` |
| Realtime | WebSocket `/ws` | HTTP polling fallback |
| State | Process memory | Per-function-instance memory (not durable/shared) |

Do not deploy wallet private keys as environment variables. ChainLab generates simulated keys in memory and never returns private key material from its API.
