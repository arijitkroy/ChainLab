const Blockchain = require("../blockchain/Blockchain");
const ChainManager = require("../blockchain/ChainManager");
const Mempool = require("../blockchain/Mempool");

class SimulatedNode {
    constructor({ id, name, hashRate = 1, address, role = "miner", initialBlockReward = 50, halvingInterval = 10 }) {
        this.id = id;
        this.name = name;
        this.address = address || name;
        this.role = role;
        this.hashRate = hashRate;
        this.miningPower = hashRate;
        this.blockchain = new Blockchain({ initialBlockReward, halvingInterval });
        this.chainManager = new ChainManager(this.blockchain);
        this.mempool = new Mempool();
        this.peers = new Set();
        this.mining = false;
        this.validating = false;
        this.online = true;
        this.forked = false;
        this.reorganizing = false;
        this.receivingTransaction = false;
        this.receivingBlock = false;
        this.stats = {
            blocksMined: 0,
            blocksReceived: 0,
            transactionsReceived: 0,
            miningAttempts: 0
        };
    }

    connect(node) {
        this.peers.add(node.id);
    }

    addTransaction(transaction) {
        if (!this.online) return { accepted: false, reason: "Node is offline" };
        const result = this.mempool.addTransaction(transaction, this.blockchain);
        if (result.accepted) {
            this.stats.transactionsReceived++;
            this.receivingTransaction = true;
            setTimeout(() => { this.receivingTransaction = false; }, 900);
        }
        return result;
    }

    removeTransaction(transactionId) {
        return this.mempool.removeTransaction(transactionId);
    }

    removeTransactions(transactions) {
        for (const transaction of transactions) this.removeTransaction(transaction.id);
    }

    addBlock(block) {
        return this.acceptBlock(block, true);
    }

    acceptBlock(block, received = false) {
        if (!this.online) return false;
        this.validating = true;
        this.receivingBlock = received;
        try {
            const result = this.chainManager.addBlock(block);
            if (!result.accepted) return false;
            if (result.forkDetected) this.forked = true;
            this.reorganizing = result.reorganization;
            if (result.reorganization) setTimeout(() => { this.reorganizing = false; }, 1200);

            if (result.canonicalChanged) {
                const connectedTransactions = result.connected.flatMap(item => item.transactions);
                const connectedIds = new Set(connectedTransactions.map(transaction => transaction.id));
                const orphanedTransactions = result.disconnected
                    .flatMap(item => item.transactions)
                    .filter(transaction => !transaction.coinbase && !connectedIds.has(transaction.id));

                this.blockchain.replaceChain(result.chain);
                this.removeTransactions(connectedTransactions);
                this.mempool.revalidate(this.blockchain);
                for (const transaction of orphanedTransactions) {
                    this.mempool.addTransaction(transaction, this.blockchain);
                }
            }

            if (received) this.stats.blocksReceived++;
            return result;
        } catch {
            return false;
        } finally {
            if (received) {
                setTimeout(() => {
                    this.validating = false;
                    this.receivingBlock = false;
                }, 800);
            } else {
                this.validating = false;
            }
        }
    }

    getBalance(address = this.address) {
        return this.blockchain.getBalance(address);
    }

    getState() {
        const latest = this.blockchain.getLatestBlock();
        return {
            id: this.id,
            name: this.name,
            address: this.address,
            role: this.role,
            hashRate: this.hashRate,
            miningPower: this.miningPower,
            online: this.online,
            validating: this.validating,
            mining: this.mining,
            forked: this.forked,
            reorganizing: this.reorganizing,
            receivingTransaction: this.receivingTransaction,
            receivingBlock: this.receivingBlock,
            localHeight: this.blockchain.getHeight(),
            tipHash: latest.hash,
            tipHashShort: `${latest.hash.slice(0, 8)}...`,
            cumulativeWork: this.blockchain.totalWork,
            mempoolSize: this.mempool.size,
            balance: this.getBalance(),
            peers: Array.from(this.peers),
            stats: { ...this.stats }
        };
    }
}

module.exports = SimulatedNode;