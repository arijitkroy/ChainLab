# 10. Structure and Roadmap

## Repository layout

```text
vercel.json                 # multi-service frontend/backend routing
backend/
  server.js                 # local/Vercel entry point
  src/
    blockchain/             # blocks, transactions, UTXOs, mining, chain manager
    network/                # simulated nodes
    simulation/             # coordinator and isolated scenarios
  test/                     # Node built-in tests
  vercel.json               # standalone backend deployment config
frontend/
  src/app/                  # dashboard and App Router labs
  src/components/           # shared graph, navigation, controls, transaction form
  src/lib/api.js            # REST and realtime/polling client
  vercel.json               # standalone Next.js deployment config
docs/                       # chaptered project documentation
README.md                   # project entry point
```

## Current implemented areas

The repository includes chain and UTXO explorers, wallets, transactions, mempool, mining, Merkle and hash labs, block-header lab, P2P visualization and node controls, mining race, forks and cumulative-work selection, reorganization handling, confirmations, controlled attack experiments, difficulty/reward labs, statistics, timeline, Explain mode, global simulation controls, and Vercel configuration.

## Known follow-up areas

The backend remains in-memory; serverless instances do not share state. The simulator uses a simplified block header and reward rules, simulated signatures, basic transaction policies, and simplified attacks. Potential future work includes durable event/state storage, mature-network consensus details, richer node-specific transaction views, responsive interaction testing, and a persistent WebSocket/background-job host for deployed realtime demonstrations.
