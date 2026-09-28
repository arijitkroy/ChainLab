# 4. Blockchain Model

## Blocks and proof-of-work

A block contains a height, version, previous hash, timestamp, transactions, Merkle root, difficulty, nonce, and calculated hash. The simulator hashes a simplified delimited header with SHA-256. Mining changes the nonce until the hash is at or below the configured target. Difficulty levels are intentionally small so the lab can complete work locally.

The target is configurable from 1 through 6 in the primary mining lab. It is a visualization setting and is not Bitcoin mainnet's compact target encoding or retarget schedule.

## Transactions and UTXOs

A normal transaction references previous transaction outputs as inputs and creates new address-locked outputs. Validation checks referenced UTXOs, duplicate inputs, conflicts within a block, valid output amounts, input/output conservation, and declared fees. Coinbase transactions are restricted to the first transaction in a block and are checked against subsidy plus fees.

The UTXO subsystem holds currently spendable outputs. The UTXO explorer reconstructs output history from the canonical chain to display spent outputs as well as live outputs.

## Fees and wallet signatures

The transaction builder selects spendable outputs, calculates change, and includes a fee. Wallet key material is generated with Node's cryptographic APIs and remains in backend memory. Input signatures are explicitly simulated HMAC labels; they are not Bitcoin ECDSA signatures and are not accepted by Bitcoin Core.

## Merkle trees

Transaction IDs are the leaves. Pairs are concatenated and SHA-256 hashed to build intermediate levels; an unpaired hash is duplicated. Proofs contain sibling hashes and left/right positions. The Merkle lab can build a demo tree in-browser and inspect a real canonical block's tree through the API.

## Mempool and propagation

Each node has a bounded mempool. A mempool rejects invalid transactions, duplicate IDs, unavailable inputs, and conflicting spends. Transactions and blocks travel across online peer links. Nodes validate received blocks before updating their local chain state.

## Chain selection and reorganizations

The ChainManager retains known valid branches and computes cumulative work as a sum derived from each block's difficulty. A strictly higher-work branch becomes canonical; ties leave the current canonical tip selected. Reorganizations identify the common ancestor, rebuild the selected UTXO set, remove newly confirmed transactions from mempools, and retry eligible transactions from orphaned blocks.

## Rewards and adjustment

The initial reward and halving interval are configurable for demonstrations. Difficulty adjustment intervals are also configurable. The default target block interval is short to make experiments practical; it is not Bitcoin's approximately ten-minute mainnet target.

## Node roles

- Miner: contributes relative hash power and can mine blocks.
- Validator: has no mining power but validates received blocks and updates chain state.
- Full node: participates in the simplified block-validation model.
- Light node: a visual role only; the current simulator still gives nodes a local chain model.

These are teaching abstractions, not exact Bitcoin network roles or message protocols.
