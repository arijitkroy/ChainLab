# ChainLab

ChainLab is an interactive, Bitcoin-inspired blockchain laboratory. Explore UTXOs, transactions, mempools, SHA-256, Merkle proofs, proof-of-work, peer propagation, forks, cumulative-work selection, reorganizations, and controlled attack models.

> ChainLab is an educational simulator, not Bitcoin Core. It is not connected to Bitcoin mainnet and must not be used to hold or transfer real funds.

## Quick Start

Requires Node.js 20.9 or newer and npm. Install and run the two applications in separate terminals:

```powershell
cd backend
npm install
npm run dev
```

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The backend listens on port 4000 by default. To use a different API origin, set `NEXT_PUBLIC_API_URL` before starting/building the frontend.

## Documentation Chapters

1. [Project overview](docs/01-project-overview.md)
2. [Architecture](docs/02-architecture.md)
3. [Local development](docs/03-local-development.md)
4. [Blockchain model](docs/04-blockchain-model.md)
5. [Application guide](docs/05-application-guide.md)
6. [HTTP and realtime API](docs/06-http-api.md)
7. [Vercel deployment](docs/07-vercel-deployment.md)
8. [Security and limitations](docs/08-security-and-limitations.md)
9. [Testing and contributions](docs/09-testing-and-contributing.md)
10. [Structure and roadmap](docs/10-structure-and-roadmap.md)

## Vercel

Deploy the repository as one Vercel project from its root. The root `vercel.json` declares the `frontend` and `backend` services, routes `/api/backend/*` to Express, and sends all other paths to Next.js. Set `NEXT_PUBLIC_API_URL` to `https://<deployment-domain>/api/backend` for Production, Preview, and Development.

Vercel's serverless functions do not provide persistent WebSockets, background mining, or shared durable process memory. The deployment is suitable for an HTTP demonstration, not a reliable shared simulation. See [Vercel deployment](docs/07-vercel-deployment.md) before publishing.

## Checks

```powershell
cd frontend
npm run lint
npm run build
```

```powershell
cd backend
npm test
```

The backend uses Node's built-in test runner.

## Important Model Boundaries

Wallet addresses and signatures are simulated; signatures are not Bitcoin ECDSA. ChainLab does not implement Bitcoin Script or production peer networking. Difficulty, reward halving, target block time, validator roles, and attack scenarios are simplified educational models. Wallet keys and all chain state are held in backend memory.
