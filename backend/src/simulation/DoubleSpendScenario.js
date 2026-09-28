const Block = require("../blockchain/Block");
const Blockchain = require("../blockchain/Blockchain");
const ChainManager = require("../blockchain/ChainManager");
const Miner = require("../blockchain/Miner");
const Mempool = require("../blockchain/Mempool");
const { Transaction } = require("../blockchain/Transaction");

class DoubleSpendScenario {
    async run({ amount = 10, difficulty = 1 } = {}) {
        if (!Number.isFinite(amount) || amount <= 0 || amount + 0.001 >= 50) {
            throw new Error("Amount must be positive and leave room for the simulated fee and change");
        }
        if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 3) {
            throw new Error("Scenario difficulty must be from 1 to 3");
        }

        const blockchain = new Blockchain();
        const transactionA = createConflictingTransaction("Bob", amount, "scenario-alpha");
        const transactionB = createConflictingTransaction("Charlie", amount, "scenario-beta");
        const mempoolA = new Mempool();
        const mempoolB = new Mempool();
        const acceptanceA = mempoolA.addTransaction(transactionA, blockchain);
        const acceptanceB = mempoolB.addTransaction(transactionB, blockchain);
        if (!acceptanceA.accepted || !acceptanceB.accepted) throw new Error("Could not prepare independent node mempools");

        const candidateA = makeBlock(blockchain, transactionA, "Miner 1", difficulty);
        const candidateB = makeBlock(blockchain, transactionB, "Miner 2", difficulty);
        const mined = await Promise.all([
            new Miner().mineBlock(candidateA),
            new Miner().mineBlock(candidateB)
        ]);
        const first = mined[0].elapsedMs <= mined[1].elapsedMs
            ? { block: candidateA, transaction: transactionA }
            : { block: candidateB, transaction: transactionB };
        const second = first.block === candidateA
            ? { block: candidateB, transaction: transactionB }
            : { block: candidateA, transaction: transactionA };

        const chainManager = new ChainManager(blockchain);
        const firstAcceptance = chainManager.addBlock(first.block);
        const competingAcceptance = chainManager.addBlock(second.block);
        const extendedState = chainManager.getBlockchainAt(second.block.hash);
        const extension = new Block({
            height: second.block.height + 1,
            previousHash: second.block.hash,
            transactions: [Transaction.createCoinbase("Miner 2", extendedState.getBlockSubsidy(second.block.height + 1))],
            difficulty
        });
        await new Miner().mineBlock(extension);
        const reorganization = chainManager.addBlock(extension);
        const canonicalIds = new Set(chainManager.getBestChain().flatMap(block => block.transactions.map(transaction => transaction.id)));

        return {
            amount,
            fee: 0.001,
            spentUtxo: { txId: "GENESIS", outputIndex: 0, address: "Alice", amount: 50 },
            nodeMempools: [
                { node: "Node 1", transactionId: transactionA.id, accepted: acceptanceA.accepted },
                { node: "Node 2", transactionId: transactionB.id, accepted: acceptanceB.accepted }
            ],
            firstConfirmed: {
                transactionId: first.transaction.id,
                recipient: first.transaction.outputs[0].address,
                blockHash: first.block.hash,
                height: first.block.height
            },
            competingBlock: {
                transactionId: second.transaction.id,
                recipient: second.transaction.outputs[0].address,
                blockHash: second.block.hash,
                height: second.block.height,
                detectedAsFork: competingAcceptance.forkDetected
            },
            reorganization: {
                occurred: reorganization.reorganization,
                forkPoint: reorganization.forkPoint.height,
                winningTip: reorganization.chain.at(-1).hash,
                cumulativeWork: reorganization.cumulativeWork
            },
            transactions: [transactionA, transactionB].map(transaction => ({
                id: transaction.id,
                recipient: transaction.outputs[0].address,
                status: canonicalIds.has(transaction.id) ? "confirmed" : "orphaned"
            })),
            explanation: "Independent nodes can accept conflicting spends locally. The branch with more cumulative work becomes canonical; the losing spend is invalid against the new UTXO set."
        };
    }
}

function createConflictingTransaction(recipient, amount, signatureLabel) {
    const fee = 0.001;
    return new Transaction({
        inputs: [{
            txId: "GENESIS",
            outputIndex: 0,
            signature: `SIMULATED:${signatureLabel}`,
            publicKey: "SIMULATED-KEY"
        }],
        outputs: [
            { address: recipient, amount },
            { address: "Alice", amount: 50 - amount - fee }
        ],
        fee
    });
}

function makeBlock(blockchain, transaction, minerAddress, difficulty) {
    return new Block({
        height: 1,
        previousHash: blockchain.getLatestBlock().hash,
        transactions: [Transaction.createCoinbase(minerAddress, 50.001), transaction],
        difficulty
    });
}

module.exports = DoubleSpendScenario;
