class Mempool {
    constructor({ maxSize = 500 } = {}) {
        this.maxSize = maxSize;
        this.transactions = new Map();
        this.reservedInputs = new Map();
    }

    get size() {
        return this.transactions.size;
    }

    addTransaction(transaction, blockchain) {
        if (!transaction?.id) return { accepted: false, reason: "Transaction ID is required" };
        if (this.hasTransaction(transaction.id)) return { accepted: false, reason: "Duplicate transaction" };
        if (this.size >= this.maxSize) return { accepted: false, reason: "Mempool is full" };
        if (!blockchain?.validateTransaction) return { accepted: false, reason: "Blockchain validator is required" };

        const spentInputs = new Set(this.reservedInputs.keys());
        const validation = blockchain.validateTransaction(transaction, blockchain.utxoSet, spentInputs);
        if (!validation.valid) return { accepted: false, reason: validation.reason };

        this.transactions.set(transaction.id, transaction);
        for (const input of transaction.inputs) {
            this.reservedInputs.set(`${input.txId}:${input.outputIndex}`, transaction.id);
        }

        return { accepted: true, fee: validation.fee };
    }

    removeTransaction(transactionId) {
        const transaction = this.transactions.get(transactionId);
        if (!transaction) return false;

        for (const input of transaction.inputs) {
            this.reservedInputs.delete(`${input.txId}:${input.outputIndex}`);
        }
        return this.transactions.delete(transactionId);
    }

    hasTransaction(transactionId) {
        return this.transactions.has(transactionId);
    }

    getTransaction(transactionId) {
        return this.transactions.get(transactionId);
    }

    getTransactions() {
        return Array.from(this.transactions.values());
    }

    clear() {
        this.transactions.clear();
        this.reservedInputs.clear();
    }

    selectTransactionsForBlock(maxTransactions = Infinity) {
        return this.getTransactions()
            .sort((left, right) => feeRate(right) - feeRate(left) || right.timestamp - left.timestamp)
            .slice(0, maxTransactions);
    }

    revalidate(blockchain) {
        const candidates = this.getTransactions();
        this.clear();
        for (const transaction of candidates) this.addTransaction(transaction, blockchain);
    }
}

function feeRate(transaction) {
    const size = Buffer.byteLength(transaction.serialize?.() ?? JSON.stringify(transaction), "utf8");
    return size ? transaction.fee / size : 0;
}

module.exports = Mempool;
