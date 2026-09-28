# 1. Project Overview

## Purpose

ChainLab is an interactive, in-memory laboratory for learning how a Bitcoin-inspired blockchain behaves. It makes transaction construction, UTXOs, SHA-256, Merkle trees, proof-of-work, peer propagation, forks, cumulative-work selection, reorganizations, and simplified attack scenarios inspectable through a browser.

The project is educational software, not a Bitcoin node, wallet, explorer for mainnet, or financial product. Its values, addresses, signatures, network, and reward schedule exist only inside the simulator.

## Main workflows

1. Inspect the default peer network and its miners, validators, and light node.
2. Create a wallet or use the seeded Alice faucet wallet.
3. Build a transaction and observe its mempool status.
4. Mine a block and inspect its transaction and UTXO effects.
5. Experiment with Merkle inclusion proofs, hashes, and block headers.
6. Simulate competing branches, chain reorganizations, mining races, and attack models.
7. Change simulation controls, difficulty, and the educational reward schedule.

## Stack

- Frontend: Next.js App Router, React, JavaScript, Tailwind CSS.
- Backend: Express 5, JavaScript, `ws` for local WebSocket snapshots.
- Domain: SHA-256, UTXO transactions, Merkle trees, proof-of-work, mempool, chain manager, and in-memory simulation state.

## Start here

Follow [Local Development](03-local-development.md) to run both apps. Use [Application Guide](05-application-guide.md) for a route-by-route tour and [Vercel Deployment](07-vercel-deployment.md) for hosting.
