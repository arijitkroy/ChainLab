# 8. Security and Limitations

## Security properties

- The backend validates transactions and blocks; the frontend is not authoritative.
- JSON bodies are bounded to 1 MiB, and transactions have input/output/address/serialized-size limits.
- API errors avoid sending stack traces to clients.
- Private wallet keys stay in backend process memory and are excluded from public wallet summaries.
- Wallet input signatures are simulated HMAC values for the lab; they are not Bitcoin ECDSA and do not provide production transaction signing.
- Never put real funds or secret credentials into ChainLab.

CORS is permissive for the current educational setup. Before exposing a modified instance to an untrusted audience, restrict origins, apply rate limits, and review every command endpoint.

## Bitcoin differences

ChainLab is not connected to Bitcoin mainnet and does not implement Bitcoin Script, consensus serialization, real ECDSA, compact difficulty targets, production peer networking, durable chain storage, coinbase maturity, or mainnet issuance rules. Difficulty, block intervals, rewards, attack scenarios, validator roles, and network powers are configurable simplified models.

The six-confirmation display is a convention often used by applications, not a protocol-level transaction guarantee. Majority hash power can reorganize recent history or affect ordering, but it cannot create valid arbitrary outputs under correct consensus validation.

## Deployment warning

Vercel deployment is useful for a frontend preview and HTTP demo. Its serverless runtime cannot guarantee the global mutable simulator state or persistent WebSocket connection expected from a continuously running node. See [Vercel Deployment](07-vercel-deployment.md) before using it for a shared demo.
