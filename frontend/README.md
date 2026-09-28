# ChainLab Frontend

ChainLab is a JavaScript-only Next.js App Router interface for an in-memory Bitcoin-inspired blockchain simulator.

Run `npm run dev` from this directory. The frontend expects the API at `http://localhost:4000`; set `NEXT_PUBLIC_API_URL` to use another backend URL.

Routes include the dashboard, network, blockchain and UTXO explorers, wallets, transactions, mempool, mining, Merkle, hash and block-header labs, fork and attack simulators, difficulty and reward controls, statistics, and timeline.

Wallet keys and signatures are simulated. ChainLab is not connected to Bitcoin mainnet and does not implement Bitcoin Script or real Bitcoin ECDSA signing.
