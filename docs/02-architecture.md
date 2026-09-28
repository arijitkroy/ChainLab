# 2. Architecture

## Runtime shape

The backend owns mutable simulation state. The Next.js frontend requests snapshots and sends commands through HTTP. In local development, `/ws` publishes an initial snapshot and changed state/event snapshots. The frontend merges those updates and refreshes detailed lists from REST endpoints when the relevant state changes.

```text
Browser (Next.js)
  | REST commands and queries
  | local WebSocket snapshots
  v
Express server
  | Simulation coordinator
  +-- Simulated nodes
  |    +-- Blockchain and UTXO set
  |    +-- Chain manager and branch index
  |    +-- Mempool
  +-- Wallets and scenarios
```

## Backend modules

- `backend/server.js`: process entry point.
- `backend/src/server.js`: Express routes, response mapping, local WebSocket upgrade handling, and Vercel Express export.
- `backend/src/simulation/Simulation.js`: authoritative in-memory state, topology, transaction flow, mining, controls, events, and chain propagation.
- `backend/src/network/SimulatedNode.js`: per-node chain, mempool, role, peers, and transient activity state.
- `backend/src/blockchain/Block.js`: simplified block header hashing and Merkle root integration.
- `backend/src/blockchain/Blockchain.js`: transaction and block validation plus UTXO application.
- `backend/src/blockchain/ChainManager.js`: valid branch storage and cumulative-work canonical selection.
- `backend/src/blockchain/Transaction.js`, `TransactionInput.js`, `TransactionOutput.js`: deterministic transaction model and validation.
- `backend/src/blockchain/UTXOSet.js`: spendable-output index and compatibility aliases.
- `backend/src/blockchain/Mempool.js`: transaction validation, conflict reservations, capacity, and block selection.
- `backend/src/blockchain/MerkleTree.js`: SHA-256 tree levels and inclusion proofs.
- `backend/src/blockchain/Miner.js`: bounded asynchronous proof-of-work with progress callbacks.
- `backend/src/blockchain/Wallet.js`: in-memory simulated keys and public wallet summaries.
- `backend/src/blockchain/DifficultyAdjustment.js`: configurable educational retargeting.
- `backend/src/simulation/*Scenario.js`: isolated mining race and attack experiments.

## Frontend modules

- `frontend/src/app/layout.js`: global shell and the one persistent navigation bar.
- `frontend/src/components/Navbar.js`: grouped route selector, connection status, and Explain mode.
- `frontend/src/components/NetworkGraph.js`: responsive node layout, drag positioning, peer links, and node inspection.
- `frontend/src/components/SimulationControls.js`: global start/pause/reset/step/speed and feature toggles.
- `frontend/src/lib/api.js`: REST functions and WebSocket-to-polling snapshot client.
- `frontend/src/app/*/page.js`: dashboard and domain labs.

## State and consistency

State is held in process memory. Each simulated node maintains a local chain view. A ChainManager stores valid known branches and chooses a canonical chain by cumulative work. On a reorganization, the node rebuilds its canonical UTXO set and returns eligible transactions from orphaned blocks to its mempool.

There is no database, cross-instance lock, durable event log, or multi-region replication. Those omissions are important when choosing deployment targets; see [Vercel Deployment](07-vercel-deployment.md).
