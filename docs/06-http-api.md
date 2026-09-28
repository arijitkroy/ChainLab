# 6. HTTP and Realtime API

The backend is an Express application. JSON POST bodies are limited to 1 MiB. API failures use a structured response where available:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Readable explanation"
  }
}
```

## Queries

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Service status |
| GET | `/api/simulation` | Full current state snapshot |
| GET | `/api/nodes` | Node summaries |
| GET | `/api/blocks` | Canonical block list and explorer summary |
| GET | `/api/blocks/:height` | Block by height |
| GET | `/api/blocks/hash/:hash` | Block by hash |
| GET | `/api/transactions?address=` | Confirmed and pending transactions, optionally address-filtered |
| GET | `/api/transactions/:id` | Transaction detail |
| GET | `/api/utxos?address=` | Output history and live UTXO summary |
| GET | `/api/wallets` | Public wallet summaries |
| GET | `/api/wallets/:walletId` | Wallet summary, UTXOs, and history |
| GET | `/api/mempool` | Unconfirmed transactions and aggregate fees |
| GET | `/api/merkle?height=` | Merkle leaves, levels, and root for a block |
| GET | `/api/forks` | Known branches and cumulative work |

## Commands

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/transactions` | Create and propagate a spend (`from`, `to`, `amount`) |
| POST | `/api/mine` | Mine with a node (`nodeId`) |
| POST | `/api/simulation/mine` | Compatibility alias for mining |
| POST | `/api/simulation/start` | Start automatic simulation |
| POST | `/api/simulation/pause` | Pause automatic simulation |
| POST | `/api/simulation/step` | Advance one logical mining step |
| POST | `/api/simulation/reset` | Rebuild default in-memory state |
| POST | `/api/simulation/speed` | Set supported speed (`speed`) |
| POST | `/api/simulation/controls` | Update boolean simulation controls |
| POST | `/api/simulation/difficulty` | Set difficulty (`difficulty`) |
| POST | `/api/simulation/difficulty-interval` | Set adjustment interval (`interval`) |
| POST | `/api/simulation/reward-schedule` | Set initial reward and halving interval |
| POST | `/api/nodes` | Create a node (`name`, `role`, `hashRate`) |
| POST | `/api/nodes/:id/start` | Reconnect and synchronize a node |
| POST | `/api/nodes/:id/stop` | Take a node offline |
| POST | `/api/wallets` | Create a simulated wallet (`name`) |
| POST | `/api/wallets/:walletId/fund` | Request a faucet transfer |
| POST | `/api/merkle/proof` | Generate an inclusion proof |
| POST | `/api/merkle/verify` | Verify a supplied proof |
| POST | `/api/forks/simulate` | Mine competing blocks |
| POST | `/api/forks/mine` | Mine on a selected branch |
| POST | `/api/race` | Run mining-race probability experiment |
| POST | `/api/attacks/double-spend/run` | Run isolated double-spend scenario |
| POST | `/api/attacks/51-percent/run` | Run isolated majority-work scenario |
| POST | `/api/attacks/selfish-mining/run` | Run simplified selfish-mining scenario |

## WebSocket

Local development serves `GET /ws`. The server sends one `SNAPSHOT`, followed by changed `UPDATE` messages. The frontend merges them and falls back to polling `GET /api/simulation` if the socket closes. Vercel's serverless backend does not host this persistent WebSocket endpoint; polling is the deployed fallback.
