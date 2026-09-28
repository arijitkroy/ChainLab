const Block = require("./Block");
const UTXOSet = require("./UTXOSet");
const { Transaction } = require("./Transaction");

class Blockchain {
    constructor({ initialBlockReward = 50, halvingInterval = 10 } = {}) {
        this.chain = [];

        this.utxoSet = new UTXOSet();

        this.totalWork = 0;
        this.initialBlockReward = initialBlockReward;
        this.halvingInterval = halvingInterval;

        this.createGenesisBlock();
    }

    createGenesisBlock() {
        const genesis = new Block({
            height: 0,
            previousHash: "0".repeat(64),
            transactions: [],
            difficulty: 2,
            timestamp: 1700000000000
        });

        genesis.nonce = 0;

        genesis.hash = genesis.calculateHash();

        this.chain.push(genesis);

        this.totalWork = Block.calculateWork(genesis.difficulty);

        /*
         * Educational faucet UTXO.
         *
         * Every node starts with the
         * exact same deterministic UTXO.
         */
        this.utxoSet.addUTXO("GENESIS", 0, { address: "Alice", amount: 50 });
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    getHeight() {
        return this.chain.length - 1;
    }

    getBalance(address) {
        return this.utxoSet.getBalance(address);
    }

    getBlockSubsidy(height) {
        return this.initialBlockReward / 2 ** Math.floor(height / this.halvingInterval);
    }

    validateTransaction(
        transaction,
        utxoSet = this.utxoSet,
        spentInBlock = new Set()
    ) {
        if (transaction instanceof Transaction) {
            return transaction.validate(utxoSet, spentInBlock);
        }

        if (transaction.coinbase) {
            return { valid: false, reason: "Coinbase transactions are only valid as the first block transaction" };
        }

        if (!Array.isArray(transaction.inputs) || !Array.isArray(transaction.outputs)) {
            return { valid: false, reason: "Transaction inputs and outputs must be arrays" };
        }

        if (!transaction.inputs.length) {
            return { valid: false, reason: "Transaction has no inputs" };
        }

        if (!transaction.outputs.length) {
            return { valid: false, reason: "Transaction has no outputs" };
        }

        if (transaction.outputs.some(output =>
            !output || typeof output.address !== "string" || !output.address.trim() ||
            !Number.isFinite(output.amount) || output.amount <= 0
        )) {
            return { valid: false, reason: "Transaction outputs must have an address and positive finite amount" };
        }

        let inputValue = 0;
        const localSpent = new Set();

        for (const input of transaction.inputs) {
            if (!input || typeof input.txId !== "string" || !Number.isInteger(input.outputIndex) || input.outputIndex < 0) {
                return { valid: false, reason: "Transaction input is malformed" };
            }

            const key = `${input.txId}:${input.outputIndex}`;

            if (
                localSpent.has(key)
            ) {
                return {
                    valid: false,
                    reason:
                        "Duplicate input"
                };
            }

            localSpent.add(key);

            if (
                spentInBlock.has(key)
            ) {
                return {
                    valid: false,
                    reason:
                        "Double spend detected"
                };
            }

            const utxo = utxoSet.getUTXO(input.txId, input.outputIndex);

            if (!utxo) {
                return {
                    valid: false,
                    reason:
                        "Referenced UTXO does not exist"
                };
            }

            if (!Number.isFinite(utxo.amount) || utxo.amount <= 0) {
                return { valid: false, reason: "Referenced UTXO has an invalid amount" };
            }

            inputValue += utxo.amount;
        }

        const outputValue = transaction.outputs.reduce((sum, output) => sum + output.amount, 0);

        if (outputValue > inputValue) {
            return {
                valid: false,
                reason:
                    "Outputs exceed inputs"
            };
        }

        const fee =
            inputValue - outputValue;

        return {
            valid: true,
            fee
        };
    }

    validateBlock(block) {
        const previous =
            this.getLatestBlock();

        if (
            block.previousHash !==
            previous.hash
        ) {
            return {
                valid: false,
                reason:
                    "Previous hash mismatch"
            };
        }

        if (
            block.height !==
            previous.height + 1
        ) {
            return {
                valid: false,
                reason:
                    "Invalid block height"
            };
        }

        const calculatedHash = block.calculateHash();

        if (calculatedHash !== block.hash) {
            return {
                valid: false,
                reason:
                    "Invalid block hash"
            };
        }

        const target = "0".repeat(block.difficulty);

        if (!block.hash.startsWith(target)) {
            return {
                valid: false,
                reason:
                    "Proof-of-Work failed"
            };
        }

        const merkleRoot = Block.calculateMerkleRoot(block.transactions);

        if (merkleRoot !== block.merkleRoot) {
            return {
                valid: false,
                reason:
                    "Merkle root mismatch"
            };
        }

        if (block.transactions.length === 0) {
            return {
                valid: false,
                reason:
                    "Block has no transactions"
            };
        }

        const coinbase =
            block.transactions[0];

        if (!coinbase.coinbase) {
            return {
                valid: false,
                reason:
                    "First transaction must be coinbase"
            };
        }

        if (block.transactions.slice(1).some(transaction => transaction.coinbase)) {
            return { valid: false, reason: "Block may contain only one coinbase transaction" };
        }

        if (
            !Array.isArray(coinbase.inputs) || coinbase.inputs.length !== 1 ||
            coinbase.inputs[0]?.txId !== "COINBASE" || coinbase.inputs[0]?.outputIndex !== -1
        ) {
            return { valid: false, reason: "Coinbase transaction input is invalid" };
        }

        if (
            !Array.isArray(coinbase.outputs) || !coinbase.outputs.length ||
            coinbase.outputs.some(output =>
                !output || typeof output.address !== "string" || !output.address.trim() || output.address.length > 128 ||
                !Number.isFinite(output.amount) || output.amount <= 0
            )
        ) {
            return { valid: false, reason: "Coinbase outputs must have an address and positive finite amount" };
        }

        const temporaryUTXO = this.utxoSet.clone();
        const spentInBlock = new Set();

        let fees = 0;

        for (
            let i = 1;
            i < block.transactions.length;
            i++
        ) {
            const transaction = block.transactions[i];
            const result = this.validateTransaction(transaction, temporaryUTXO, spentInBlock);

            if (!result.valid) {
                return result;
            }

            fees += result.fee;

            for (const input of transaction.inputs) {
                const key = `${input.txId}:${input.outputIndex}`;

                spentInBlock.add(key);

                temporaryUTXO.removeUTXO(input.txId, input.outputIndex);
            }

            transaction.outputs.forEach((output, index) => {
                temporaryUTXO.addUTXO(transaction.id, index, output);
            });
        }

        const reward = this.getBlockSubsidy(block.height) + fees;

        const coinbaseValue =
            coinbase.outputs.reduce(
                (sum, output) =>
                    sum + output.amount,
                0
            );

        if (
            coinbaseValue >
            reward
        ) {
            return {
                valid: false,
                reason:
                    "Coinbase reward exceeds block reward plus fees"
            };
        }

        return {
            valid: true,
            fees,
            reward
        };
    }

    addBlock(block) {
        const validation =
            this.validateBlock(
                block
            );

        if (!validation.valid) {
            throw new Error(
                validation.reason
            );
        }

        /*
         * Apply normal transactions.
         */
        for (
            let i = 1;
            i < block.transactions.length;
            i++
        ) {
            const transaction =
                block.transactions[i];

            for (
                const input of
                transaction.inputs
            ) {
                this.utxoSet.removeUTXO(input.txId, input.outputIndex);
            }

            transaction.outputs.forEach(
                (output, index) => {
                    this.utxoSet.addUTXO(transaction.id, index, output);
                }
            );
        }

        /*
         * Apply coinbase.
         */
        const coinbase =
            block.transactions[0];

        coinbase.outputs.forEach(
            (output, index) => {
                this.utxoSet.addUTXO(coinbase.id, index, output);
            }
        );

        this.chain.push(block);

        this.totalWork +=
            Block.calculateWork(
                block.difficulty
            );

        return block;
    }

    isValid() {
        /*
         * Reconstruct the chain from
         * scratch.
         */
        const rebuilt =
            new Blockchain();

        for (
            let i = 1;
            i < this.chain.length;
            i++
        ) {
            try {
                rebuilt.addBlock(
                    this.chain[i]
                );
            } catch {
                return false;
            }
        }

        return true;
    }

    getBlocks() {
        return this.chain;
    }

    getUTXOs() {
        return this.utxoSet.getAllUTXOs();
    }

    replaceChain(blocks) {
        if (!Array.isArray(blocks) || !blocks.length) throw new Error("Replacement chain must include genesis");

        const replacement = new Blockchain({
            initialBlockReward: this.initialBlockReward,
            halvingInterval: this.halvingInterval
        });
        for (const block of blocks.slice(1)) replacement.addBlock(block);
        this.chain = replacement.chain;
        this.utxoSet = replacement.utxoSet;
        this.totalWork = replacement.totalWork;
        return this.chain;
    }
}

module.exports = Blockchain;