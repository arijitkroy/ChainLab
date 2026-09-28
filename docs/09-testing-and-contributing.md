# 9. Testing and Contributions

## Verification commands

Frontend checks:

```powershell
cd frontend
npm run lint
npm run build
```

Backend tests and syntax checks:

```powershell
cd backend
npm test
```

The backend uses Node's built-in `node:test` runner. Test files live in `backend/test/` and cover block validation, transactions, UTXOs, mempool conflicts, Merkle proofs, mining, chain selection/reorganization, difficulty adjustment, wallet privacy, and isolated scenarios.

## Change guidelines

- Keep JavaScript; do not convert files to TypeScript.
- Preserve the in-memory, modular architecture unless a task explicitly changes it.
- Add new protocol behavior to backend domain modules and expose it through Express routes.
- Keep frontend pages under the App Router and reuse `frontend/src/lib/api.js`.
- Add tests for consensus-sensitive changes. Do not describe educational behavior as exact Bitcoin Core behavior.
- Keep the root README an index; put detailed chapters in `docs/`.

## Pull request checklist

- Explain behavior and simulation limitations.
- Add or update tests for consensus and transaction changes.
- Run frontend lint/build and backend tests.
- Confirm local WebSocket behavior and HTTP polling fallback remain usable.
- Check that no secret wallet material is returned by public API responses.
