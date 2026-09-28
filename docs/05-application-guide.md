# 5. Application Guide

The global navigation selector groups pages into Overview, Chain, Labs, and Attack Lab. Explain mode provides concise protocol definitions. Most routes refresh from backend snapshots; block, transaction, UTXO, and mempool details use REST queries.

## Overview

- **Dashboard**: network height, difficulty, reward, miners, validators, hash-power weight, mempool, UTXO supply, recent blocks and transactions, topology, and simulation controls.
- **Network**: peer graph, node creation, role and hash power configuration, offline/reconnect controls, and network events.
- **Statistics**: chain, transaction, mining, mempool, UTXO, fork, and reorganization metrics.
- **Timeline**: recorded events and block-height snapshots for scrubbing.

## Chain workflows

- **Blockchain**: select a block and inspect its header, confirmations, fees, reward, size, and transactions.
- **Transactions**: filter confirmed and pending transactions, then expand details.
- **Mempool**: inspect unconfirmed transactions, fee rate, inputs, outputs, and age.
- **UTXOs**: filter output history by address and spent/unspent status.
- **Wallets**: create simulated wallets, inspect balances/history/UTXOs, request a faucet transfer, and build spends.

## Labs

- **Mining**: select a miner, tune difficulty, and watch backend nonce/hash progress.
- **Mining race**: compare configured hash-power proportions with a bounded probability experiment.
- **Merkle**: edit demo transaction text, view tree levels, and verify a proof.
- **Hash**: compare SHA-256 output after editing one character.
- **Block header**: edit fields and recalculate the simplified header hash.
- **Forks**: create competing blocks, mine on a branch, and inspect cumulative-work selection.
- **Difficulty** and **Rewards**: configure educational adjustment and halving intervals.

## Attack Lab

- **Double spend**: independent scenario nodes accept conflicting transactions, then a competing branch demonstrates canonical selection.
- **51% attack**: compare attacker and honest work in a probabilistic experiment.
- **Selfish mining**: explore a simplified private-lead and block-publication model.

Attack pages run isolated scenarios and do not mutate the live network.
